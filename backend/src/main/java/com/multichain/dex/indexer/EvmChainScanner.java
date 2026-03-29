package com.multichain.dex.indexer;

import com.multichain.dex.domain.entity.Chain;
import com.multichain.dex.domain.entity.HtlcSwap;
import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.entity.Token;
import com.multichain.dex.domain.enums.*;
import com.multichain.dex.repository.ChainRepository;
import com.multichain.dex.repository.HtlcSwapRepository;
import com.multichain.dex.repository.OrderRepository;
import com.multichain.dex.repository.TokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.web3j.abi.*;
import org.web3j.abi.datatypes.*;
import org.web3j.abi.datatypes.generated.*;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameter;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.EthFilter;
import org.web3j.protocol.core.methods.response.EthLog;
import org.web3j.protocol.core.methods.response.Log;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.crypto.Hash;
import org.web3j.utils.Numeric;
import org.web3j.protocol.http.HttpService;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Scans EVM blockchains for order and HTLC state changes.
 *
 * <p>Optimizations:
 * <ul>
 *   <li>Incremental order scanning: only new orders (from lastIndexedOrderId)</li>
 *   <li>Terminal orders skipped on status refresh</li>
 *   <li>Only ACTIVE HTLCs polled for status changes</li>
 *   <li>RPC calls have retry with backoff</li>
 *   <li>Each order upserted in its own implicit transaction</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EvmChainScanner implements ChainScanner {

    private final OrderRepository orderRepo;
    private final HtlcSwapRepository htlcRepo;
    private final TokenRepository tokenRepo;
    private final ChainRepository chainRepo;

    private final Map<String, Web3j> web3jCache = new ConcurrentHashMap<>();
    /** Track RPC URLs to invalidate cache if changed. */
    private final Map<String, String> rpcUrlCache = new ConcurrentHashMap<>();

    private static final int MAX_RETRIES = 2;

    private static final Map<Integer, HtlcStatus> HTLC_STATUS_MAP = Map.of(
            1, HtlcStatus.ACTIVE, 2, HtlcStatus.WITHDRAWN, 3, HtlcStatus.REFUNDED
    );

    private static final Map<Integer, OrderStatus> ORDER_STATUS_MAP = Map.of(
            0, OrderStatus.ACTIVE, 1, OrderStatus.MATCHED, 2, OrderStatus.COMPLETED,
            3, OrderStatus.CANCELLED, 4, OrderStatus.EXPIRED
    );

    // ── ChainScanner interface ────────────────────────────────────────────

    @Override
    public void scanOrders(Chain chain) {
        try {
            Web3j web3j = getWeb3j(chain);

            // Same-chain OrderBook
            String orderBookAddr = chain.getContract("orderBook");
            if (orderBookAddr != null) {
                scanOrderBookIncremental(chain, web3j, orderBookAddr, "orderCounter", true);
            }

            // CrossChainOrderBook
            String ccobAddr = chain.getContract("ccob");
            if (ccobAddr != null) {
                scanOrderBookIncremental(chain, web3j, ccobAddr, "getTotalOrders", false);
            }
        } catch (Exception e) {
            log.error("[EVM:{}] Failed to scan orders", chain.getId(), e);
        }
    }

    @Override
    public void scanHtlcs(Chain chain) {
        try {
            Web3j web3j = getWeb3j(chain);
            String htlcAddr = chain.getContract("htlc");
            if (htlcAddr == null) return;

            BigInteger latestBlock = retryRpc(() -> web3j.ethBlockNumber().send().getBlockNumber());
            long latest = latestBlock.longValue();

            // Alchemy Free tier limits eth_getLogs to 10-block range.
            // Scan multiple 10-block chunks per cycle to catch up quickly (max 100 chunks = 1000 blocks).
            long cursor = chain.getLastIndexedBlock() + 1;
            int maxChunks = 100;

            for (int chunk = 0; chunk < maxChunks && cursor <= latest; chunk++) {
                long fromBlock = cursor;
                long toBlock = Math.min(fromBlock + 9, latest);

                scanSwapCreatedEvents(chain, web3j, htlcAddr, fromBlock, toBlock);
                scanSwapWithdrawnEvents(chain, web3j, htlcAddr, fromBlock, toBlock);
                scanSwapRefundedEvents(chain, web3j, htlcAddr, fromBlock, toBlock);

                cursor = toBlock + 1;
            }

            // Poll existing ACTIVE HTLCs for status changes (fallback)
            List<HtlcSwap> activeHtlcs = htlcRepo.findByChainIdAndStatus(chain.getId(), HtlcStatus.ACTIVE);
            for (HtlcSwap htlc : activeHtlcs) {
                if (htlc.getOnChainSwapId() == null) continue;
                try {
                    updateHtlcStatus(web3j, htlcAddr, htlc);
                } catch (Exception e) {
                    log.warn("[EVM:{}] Failed to update HTLC {}", chain.getId(), htlc.getOnChainSwapId(), e);
                }
            }

            chain.setLastIndexedBlock(cursor - 1);
        } catch (Exception e) {
            log.error("[EVM:{}] Failed to scan HTLCs", chain.getId(), e);
        }
    }

    @Override
    public void processTransaction(Chain chain, String txHash) {
        try {
            Web3j web3j = getWeb3j(chain);
            TransactionReceipt receipt = retryRpc(() ->
                    web3j.ethGetTransactionReceipt(txHash).send().getTransactionReceipt().orElse(null));

            if (receipt == null || !"0x1".equals(receipt.getStatus())) {
                log.warn("[EVM:{}] Tx {} not found or failed", chain.getId(), txHash);
                return;
            }

            scanOrders(chain);
            scanHtlcs(chain);
            log.info("[EVM:{}] Processed tx {}", chain.getId(), txHash);
        } catch (Exception e) {
            log.error("[EVM:{}] Failed to process tx {}", chain.getId(), txHash, e);
        }
    }

    // ── Incremental order scanning ────────────────────────────────────────

    /**
     * Scan orders incrementally:
     * 1. New orders: from lastIndexedOrderId+1 to current total
     * 2. Existing non-terminal orders: refresh status only
     */
    private void scanOrderBookIncremental(Chain chain, Web3j web3j, String contractAddr,
                                           String counterFn, boolean isSameChain) throws Exception {
        BigInteger totalOrders = retryRpc(() -> callUint256(web3j, contractAddr, counterFn));
        if (totalOrders == null) return;

        long total = totalOrders.longValue();
        // Use separate counters for same-chain (OrderBook) vs cross-chain (CCOB)
        long lastScanned = isSameChain ? chain.getLastIndexedScOrderId() : chain.getLastIndexedOrderId();

        // 1. Scan NEW orders only (from lastScanned+1 to total)
        int newOrders = 0;
        for (long i = Math.max(lastScanned + 1, 1); i <= total; i++) {
            try {
                final long ordIdx = i;
                Map<String, Object> data = retryRpc(() ->
                        isSameChain ? callGetOrder(web3j, contractAddr, BigInteger.valueOf(ordIdx))
                                    : callGetCcobOrder(web3j, contractAddr, BigInteger.valueOf(ordIdx)));
                if (data == null) continue;

                if (isSameChain) {
                    upsertSameChainOrder(chain, String.valueOf(ordIdx), data);
                } else {
                    upsertCrossChainOrder(chain, String.valueOf(ordIdx), data);
                }
                newOrders++;
            } catch (Exception e) {
                log.trace("[EVM:{}] Failed to read order {}", chain.getId(), i, e);
            }
        }

        // 2. Refresh status of existing NON-TERMINAL orders (lightweight: only status field)
        refreshNonTerminalOrders(chain, web3j, contractAddr, isSameChain);

        if (newOrders > 0) {
            log.info("[EVM:{}] Indexed {} new order(s) from {}", chain.getId(), newOrders, contractAddr);
        }

        // Update high-water mark (separate for same-chain vs cross-chain)
        if (total > lastScanned) {
            if (isSameChain) {
                chain.setLastIndexedScOrderId(total);
            } else {
                chain.setLastIndexedOrderId(total);
            }
        }
    }

    /**
     * For existing non-terminal orders, re-read status from chain.
     * Only reads orders we already have in DB that aren't completed/cancelled.
     */
    private void refreshNonTerminalOrders(Chain chain, Web3j web3j, String contractAddr, boolean isSameChain) {
        var activeOrders = orderRepo.findByPhaseNotIn(Set.of(SwapPhase.COMPLETED, SwapPhase.REFUNDED)).stream()
                .filter(o -> o.getSourceChainId().equals(chain.getId()))
                .filter(o -> isSameChain ? o.getOrderType() == OrderType.SAME_CHAIN : o.getOrderType() == OrderType.CROSS_CHAIN)
                .toList();

        for (Order order : activeOrders) {
            try {
                BigInteger orderId = new BigInteger(order.getOnChainOrderId());
                Map<String, Object> data = retryRpc(() ->
                        isSameChain ? callGetOrder(web3j, contractAddr, orderId)
                                    : callGetCcobOrder(web3j, contractAddr, orderId));
                if (data == null) continue;

                if (isSameChain) {
                    upsertSameChainOrder(chain, order.getOnChainOrderId(), data);
                } else {
                    upsertCrossChainOrder(chain, order.getOnChainOrderId(), data);
                }
            } catch (Exception e) {
                log.trace("[EVM:{}] Failed to refresh order {}", chain.getId(), order.getOnChainOrderId());
            }
        }
    }

    // ── EVM HTLC event scanning ─────────────────────────────────────────

    // keccak256("SwapCreated(bytes32,address,address,address,uint256,bytes32,uint256)")
    private static final String SWAP_CREATED_TOPIC = EventEncoder.encode(
            new Event("SwapCreated", List.of(
                    new TypeReference<Bytes32>(true) {},
                    new TypeReference<Address>(true) {},
                    new TypeReference<Address>(true) {},
                    new TypeReference<Address>() {},
                    new TypeReference<Uint256>() {},
                    new TypeReference<Bytes32>() {},
                    new TypeReference<Uint256>() {}
            ))
    );

    // keccak256("SwapWithdrawn(bytes32,bytes32,address)")
    private static final String SWAP_WITHDRAWN_TOPIC = EventEncoder.encode(
            new Event("SwapWithdrawn", List.of(
                    new TypeReference<Bytes32>(true) {},
                    new TypeReference<Bytes32>() {},
                    new TypeReference<Address>(true) {}
            ))
    );

    // keccak256("SwapRefunded(bytes32,address)")
    private static final String SWAP_REFUNDED_TOPIC = EventEncoder.encode(
            new Event("SwapRefunded", List.of(
                    new TypeReference<Bytes32>(true) {},
                    new TypeReference<Address>(true) {}
            ))
    );

    /**
     * Discover new HTLCs from SwapCreated events.
     * Links each HTLC to an order via hashlock matching.
     */
    private void scanSwapCreatedEvents(Chain chain, Web3j web3j, String htlcAddr,
                                        long fromBlock, long toBlock) {
        try {
            EthFilter filter = new EthFilter(
                    DefaultBlockParameter.valueOf(BigInteger.valueOf(fromBlock)),
                    DefaultBlockParameter.valueOf(BigInteger.valueOf(toBlock)),
                    htlcAddr
            );
            filter.addSingleTopic(SWAP_CREATED_TOPIC);

            List<EthLog.LogResult> logs = retryRpc(() -> web3j.ethGetLogs(filter).send().getLogs());
            if (logs == null || logs.isEmpty()) return;

            int discovered = 0;
            for (EthLog.LogResult logResult : logs) {
                try {
                    Log logEntry = (Log) logResult.get();

                    // Indexed params from topics: swapId (topic1), initiator (topic2), participant (topic3)
                    String swapId = logEntry.getTopics().get(1);
                    String initiator = "0x" + logEntry.getTopics().get(2).substring(26);
                    String participant = "0x" + logEntry.getTopics().get(3).substring(26);

                    // Non-indexed params from data: token, amount, hashlock, timelock
                    String data = logEntry.getData();
                    @SuppressWarnings("rawtypes")
                    List<Type> decoded = FunctionReturnDecoder.decode(data,
                            org.web3j.abi.Utils.convert(List.of(
                                    new TypeReference<Address>() {},
                                    new TypeReference<Uint256>() {},
                                    new TypeReference<Bytes32>() {},
                                    new TypeReference<Uint256>() {}
                            )));
                    if (decoded.size() < 4) continue;

                    String tokenAddr = ((Address) decoded.get(0)).getValue();
                    BigInteger amount = ((Uint256) decoded.get(1)).getValue();
                    String hashlock = "0x" + org.web3j.utils.Numeric.toHexStringNoPrefixZeroPadded(
                            new BigInteger(1, ((Bytes32) decoded.get(2)).getValue()), 64);
                    BigInteger timelock = ((Uint256) decoded.get(3)).getValue();

                    // Skip if HTLC already exists in DB
                    if (htlcRepo.findByOnChainSwapId(swapId).isPresent()) continue;

                    // Link to order: try hashlock first, then address matching
                    Order linkedOrder = htlcRepo.findFirstByHashlockIgnoreCase(hashlock)
                            .map(HtlcSwap::getOrder)
                            .orElse(null);

                    // Fallback: find matched order by initiator/participant addresses
                    if (linkedOrder == null) {
                        var candidates = orderRepo.findMatchedByAddresses(initiator, participant);
                        // Pick the first candidate that doesn't already have this role's HTLC
                        for (var candidate : candidates) {
                            HtlcRole candidateRole = initiator.equalsIgnoreCase(candidate.getCreator())
                                    ? HtlcRole.CREATOR : HtlcRole.MATCHER;
                            if (htlcRepo.findByOrderIdAndRole(candidate.getId(), candidateRole).isEmpty()) {
                                linkedOrder = candidate;
                                break;
                            }
                        }
                    }

                    if (linkedOrder == null) continue;

                    // Determine role: initiator == order creator → CREATOR, else MATCHER
                    HtlcRole role = initiator.equalsIgnoreCase(linkedOrder.getCreator())
                            ? HtlcRole.CREATOR : HtlcRole.MATCHER;

                    // Don't create duplicate
                    if (htlcRepo.findByOrderIdAndRole(linkedOrder.getId(), role).isPresent()) continue;

                    Token token = resolveToken(chain.getId(), tokenAddr);

                    HtlcSwap htlc = HtlcSwap.builder()
                            .order(linkedOrder)
                            .role(role)
                            .chain(chain)
                            .onChainSwapId(swapId)
                            .initiator(initiator)
                            .participant(participant)
                            .token(token)
                            .amount(amount)
                            .hashlock(hashlock)
                            .timelock(Instant.ofEpochSecond(timelock.longValue()))
                            .status(HtlcStatus.ACTIVE)
                            .creationTxHash(logEntry.getTransactionHash())
                            .build();

                    htlcRepo.save(htlc);
                    discovered++;
                    log.info("[EVM:{}] Discovered HTLC {} for order {} (role={})",
                            chain.getId(), swapId, linkedOrder.getOnChainOrderId(), role);

                } catch (Exception e) {
                    log.trace("[EVM:{}] Failed to process SwapCreated event", chain.getId(), e);
                }
            }

            if (discovered > 0) {
                log.info("[EVM:{}] Discovered {} new HTLC(s) from events", chain.getId(), discovered);
            }
        } catch (Exception e) {
            log.warn("[EVM:{}] Failed to scan SwapCreated events", chain.getId(), e);
        }
    }

    /**
     * Extract revealed secrets from SwapWithdrawn events.
     */
    private void scanSwapWithdrawnEvents(Chain chain, Web3j web3j, String htlcAddr,
                                          long fromBlock, long toBlock) {
        try {
            EthFilter filter = new EthFilter(
                    DefaultBlockParameter.valueOf(BigInteger.valueOf(fromBlock)),
                    DefaultBlockParameter.valueOf(BigInteger.valueOf(toBlock)),
                    htlcAddr
            );
            filter.addSingleTopic(SWAP_WITHDRAWN_TOPIC);

            List<EthLog.LogResult> logs = retryRpc(() -> web3j.ethGetLogs(filter).send().getLogs());
            if (logs == null || logs.isEmpty()) return;

            for (EthLog.LogResult logResult : logs) {
                try {
                    Log logEntry = (Log) logResult.get();
                    String swapId = logEntry.getTopics().get(1);

                    var htlcOpt = htlcRepo.findByOnChainSwapId(swapId);
                    if (htlcOpt.isEmpty()) continue;

                    HtlcSwap htlc = htlcOpt.get();
                    if (htlc.getStatus() != HtlcStatus.ACTIVE) continue;

                    // Extract secret from non-indexed data
                    @SuppressWarnings("rawtypes")
                    List<Type> decoded = FunctionReturnDecoder.decode(logEntry.getData(),
                            org.web3j.abi.Utils.convert(List.of(new TypeReference<Bytes32>() {})));

                    if (!decoded.isEmpty()) {
                        String secret = "0x" + org.web3j.utils.Numeric.toHexStringNoPrefixZeroPadded(
                                new BigInteger(1, ((Bytes32) decoded.get(0)).getValue()), 64);
                        htlc.setSecret(secret);
                    }

                    htlc.setStatus(HtlcStatus.WITHDRAWN);
                    htlc.setWithdrawTxHash(logEntry.getTransactionHash());
                    htlcRepo.save(htlc);

                    log.info("[EVM:{}] HTLC {} withdrawn, secret revealed", chain.getId(), swapId);
                } catch (Exception e) {
                    log.trace("[EVM:{}] Failed to process SwapWithdrawn event", chain.getId(), e);
                }
            }
        } catch (Exception e) {
            log.warn("[EVM:{}] Failed to scan SwapWithdrawn events", chain.getId(), e);
        }
    }

    /**
     * Detect refunded HTLCs from SwapRefunded events.
     */
    private void scanSwapRefundedEvents(Chain chain, Web3j web3j, String htlcAddr,
                                         long fromBlock, long toBlock) {
        try {
            EthFilter filter = new EthFilter(
                    DefaultBlockParameter.valueOf(BigInteger.valueOf(fromBlock)),
                    DefaultBlockParameter.valueOf(BigInteger.valueOf(toBlock)),
                    htlcAddr
            );
            filter.addSingleTopic(SWAP_REFUNDED_TOPIC);

            List<EthLog.LogResult> logs = retryRpc(() -> web3j.ethGetLogs(filter).send().getLogs());
            if (logs == null || logs.isEmpty()) return;

            for (EthLog.LogResult logResult : logs) {
                try {
                    Log logEntry = (Log) logResult.get();
                    String swapId = logEntry.getTopics().get(1);

                    var htlcOpt = htlcRepo.findByOnChainSwapId(swapId);
                    if (htlcOpt.isEmpty()) continue;

                    HtlcSwap htlc = htlcOpt.get();
                    if (htlc.getStatus() != HtlcStatus.ACTIVE) continue;

                    htlc.setStatus(HtlcStatus.REFUNDED);
                    htlc.setRefundTxHash(logEntry.getTransactionHash());
                    htlcRepo.save(htlc);

                    log.info("[EVM:{}] HTLC {} refunded", chain.getId(), swapId);
                } catch (Exception e) {
                    log.trace("[EVM:{}] Failed to process SwapRefunded event", chain.getId(), e);
                }
            }
        } catch (Exception e) {
            log.warn("[EVM:{}] Failed to scan SwapRefunded events", chain.getId(), e);
        }
    }

    // ── HTLC status update (fallback polling) ─────────────────────────────

    private void updateHtlcStatus(Web3j web3j, String htlcAddr, HtlcSwap htlc) throws Exception {
        String data = FunctionEncoder.encode(new Function(
                "getSwap",
                List.of(new Bytes32(hexToBytes32(htlc.getOnChainSwapId()))),
                List.of(
                        new TypeReference<Address>() {}, new TypeReference<Address>() {},
                        new TypeReference<Address>() {}, new TypeReference<Uint256>() {},
                        new TypeReference<Bytes32>() {}, new TypeReference<Uint256>() {},
                        new TypeReference<Uint8>() {}
                )
        ));

        String result = retryRpc(() -> ethCall(web3j, htlcAddr, data));
        if (result == null || result.length() < 10) return;

        @SuppressWarnings("rawtypes")
        List<Type> decoded = FunctionReturnDecoder.decode(result,
                org.web3j.abi.Utils.convert(List.of(
                        new TypeReference<Address>() {}, new TypeReference<Address>() {},
                        new TypeReference<Address>() {}, new TypeReference<Uint256>() {},
                        new TypeReference<Bytes32>() {}, new TypeReference<Uint256>() {},
                        new TypeReference<Uint8>() {}
                )));
        if (decoded.size() < 7) return;

        int statusInt = ((Uint8) decoded.get(6)).getValue().intValue();
        HtlcStatus newStatus = HTLC_STATUS_MAP.getOrDefault(statusInt, null);

        // Always sync hashlock, amount, timelock from chain (may be missing on first discovery)
        boolean changed = false;

        if (newStatus != null && newStatus != htlc.getStatus()) {
            log.info("[EVM] HTLC {} status: {} → {}", htlc.getOnChainSwapId(), htlc.getStatus(), newStatus);
            htlc.setStatus(newStatus);
            changed = true;
        }

        // Extract and persist hashlock if missing
        String hashlock = "0x" + org.web3j.utils.Numeric.toHexStringNoPrefixZeroPadded(
                new BigInteger(1, ((Bytes32) decoded.get(4)).getValue()), 64);
        if (htlc.getHashlock() == null || htlc.getHashlock().isEmpty()) {
            htlc.setHashlock(hashlock);
            changed = true;
        }

        // Sync amount and timelock
        BigInteger amount = ((Uint256) decoded.get(3)).getValue();
        if (htlc.getAmount() == null || !htlc.getAmount().equals(amount)) {
            htlc.setAmount(amount);
            changed = true;
        }
        Instant timelock = Instant.ofEpochSecond(((Uint256) decoded.get(5)).getValue().longValue());
        htlc.setTimelock(timelock);

        if (changed) {
            htlcRepo.save(htlc);
        }
    }

    // ── Upsert logic ──────────────────────────────────────────────────────

    private void upsertSameChainOrder(Chain chain, String orderId, Map<String, Object> data) {
        var existing = orderRepo.findBySourceChain_IdAndOnChainOrderIdAndOrderType(chain.getId(), orderId, OrderType.SAME_CHAIN);
        int statusInt = (int) data.get("status");
        OrderStatus status = ORDER_STATUS_MAP.getOrDefault(statusInt, OrderStatus.ACTIVE);

        if (existing.isPresent() && existing.get().getStatus().isTerminal()) return;

        Order order = existing.orElseGet(() -> Order.builder()
                .sourceChain(chain).onChainOrderId(orderId).orderType(OrderType.SAME_CHAIN)
                .creator((String) data.get("creator"))
                .sellToken(resolveToken(chain.getId(), (String) data.get("tokenToSell")))
                .sellAmount((BigInteger) data.get("sellAmount"))
                .buyToken(resolveToken(chain.getId(), (String) data.get("tokenToBuy")))
                .buyAmount((BigInteger) data.get("buyAmount"))
                .build());

        order.setStatus(status);
        if (status == OrderStatus.COMPLETED && order.getCompletedAt() == null) {
            order.setCompletedAt(Instant.now());
        }
        orderRepo.save(order);
    }

    private void upsertCrossChainOrder(Chain chain, String orderId, Map<String, Object> data) {
        var existing = orderRepo.findBySourceChain_IdAndOnChainOrderIdAndOrderType(chain.getId(), orderId, OrderType.CROSS_CHAIN);
        int statusInt = (int) data.get("status");
        OrderStatus status = ORDER_STATUS_MAP.getOrDefault(statusInt, OrderStatus.ACTIVE);

        if (existing.isPresent() && existing.get().getStatus().isTerminal()) return;

        String targetChainId = resolveTargetChainId((BigInteger) data.get("targetChainId"));

        Order order = existing.orElseGet(() -> Order.builder()
                .sourceChain(chain).onChainOrderId(orderId).orderType(OrderType.CROSS_CHAIN)
                .creator((String) data.get("creator"))
                .sellToken(resolveToken(chain.getId(), (String) data.get("sellToken")))
                .sellAmount((BigInteger) data.get("sellAmount"))
                .buyToken(resolveTokenCrossChain(chain.getId(), targetChainId, (String) data.get("buyToken")))
                .buyAmount((BigInteger) data.get("buyAmount"))
                .targetChain(chainRepo.findById(targetChainId).orElse(null))
                .targetAddress((String) data.get("targetAddress"))
                .build());

        order.setStatus(status);

        // Backfill buyToken if it was null (e.g. EVM placeholder not yet resolved)
        if (order.getBuyToken() == null) {
            order.setBuyToken(resolveTokenCrossChain(chain.getId(), targetChainId, (String) data.get("buyToken")));
        }

        String matchedBy = (String) data.get("matchedBy");
        if (matchedBy != null && !matchedBy.equals("0x0000000000000000000000000000000000000000") && order.getMatcher() == null) {
            order.setMatcher(matchedBy);
            order.setMatchedAt(Instant.now());
        }

        BigInteger expiresAt = (BigInteger) data.get("expiresAt");
        if (expiresAt != null && expiresAt.longValue() > 0) {
            order.setExpiresAt(Instant.ofEpochSecond(expiresAt.longValue()));
        }

        if (status == OrderStatus.COMPLETED && order.getCompletedAt() == null) {
            order.setCompletedAt(Instant.now());
        }
        orderRepo.save(order);
    }

    // ── Contract call helpers ─────────────────────────────────────────────

    private BigInteger callUint256(Web3j web3j, String contract, String function) throws Exception {
        String data = FunctionEncoder.encode(new Function(function, List.of(), List.of(new TypeReference<Uint256>() {})));
        String result = ethCall(web3j, contract, data);
        if (result == null || result.equals("0x")) return null;
        var decoded = FunctionReturnDecoder.decode(result, org.web3j.abi.Utils.convert(List.of(new TypeReference<Uint256>() {})));
        return decoded.isEmpty() ? null : ((Uint256) decoded.get(0)).getValue();
    }

    private Map<String, Object> callGetOrder(Web3j web3j, String contract, BigInteger orderId) throws Exception {
        String data = FunctionEncoder.encode(new Function("getOrder", List.of(new Uint256(orderId)), List.of(
                new TypeReference<Uint256>() {}, new TypeReference<Address>() {}, new TypeReference<Address>() {},
                new TypeReference<Address>() {}, new TypeReference<Uint256>() {}, new TypeReference<Uint256>() {},
                new TypeReference<Uint8>() {})));
        String result = ethCall(web3j, contract, data);
        if (result == null || result.length() < 10) return null;
        var d = FunctionReturnDecoder.decode(result, org.web3j.abi.Utils.convert(List.of(
                new TypeReference<Uint256>() {}, new TypeReference<Address>() {}, new TypeReference<Address>() {},
                new TypeReference<Address>() {}, new TypeReference<Uint256>() {}, new TypeReference<Uint256>() {},
                new TypeReference<Uint8>() {})));
        if (d.size() < 7) return null;
        return Map.of("id", ((Uint256)d.get(0)).getValue(), "creator", ((Address)d.get(1)).getValue(),
                "tokenToSell", ((Address)d.get(2)).getValue(), "tokenToBuy", ((Address)d.get(3)).getValue(),
                "sellAmount", ((Uint256)d.get(4)).getValue(), "buyAmount", ((Uint256)d.get(5)).getValue(),
                "status", ((Uint8)d.get(6)).getValue().intValue());
    }

    /**
     * Decode CrossChainOrder struct (14 fields):
     * id, creator, sellToken, sellAmount, sourceChainId, buyToken, buyAmount,
     * targetChainId, targetAddress, minTimelock, expiresAt, status, matchedBy, htlcSwapId
     */
    private Map<String, Object> callGetCcobOrder(Web3j web3j, String contract, BigInteger orderId) throws Exception {
        String data = FunctionEncoder.encode(new Function("getOrder", List.of(new Uint256(orderId)), List.of(
                new TypeReference<Uint256>() {},  // 0: id
                new TypeReference<Address>() {},  // 1: creator
                new TypeReference<Address>() {},  // 2: sellToken
                new TypeReference<Uint256>() {},  // 3: sellAmount
                new TypeReference<Uint256>() {},  // 4: sourceChainId
                new TypeReference<Address>() {},  // 5: buyToken
                new TypeReference<Uint256>() {},  // 6: buyAmount
                new TypeReference<Uint256>() {},  // 7: targetChainId
                new TypeReference<Address>() {},  // 8: targetAddress
                new TypeReference<Uint256>() {},  // 9: minTimelock
                new TypeReference<Uint256>() {},  // 10: expiresAt
                new TypeReference<Uint8>() {},    // 11: status
                new TypeReference<Address>() {},  // 12: matchedBy
                new TypeReference<Bytes32>() {}   // 13: htlcSwapId
        )));
        String result = ethCall(web3j, contract, data);
        if (result == null || result.length() < 10) return null;
        var d = FunctionReturnDecoder.decode(result, org.web3j.abi.Utils.convert(List.of(
                new TypeReference<Uint256>() {},  // 0: id
                new TypeReference<Address>() {},  // 1: creator
                new TypeReference<Address>() {},  // 2: sellToken
                new TypeReference<Uint256>() {},  // 3: sellAmount
                new TypeReference<Uint256>() {},  // 4: sourceChainId
                new TypeReference<Address>() {},  // 5: buyToken
                new TypeReference<Uint256>() {},  // 6: buyAmount
                new TypeReference<Uint256>() {},  // 7: targetChainId
                new TypeReference<Address>() {},  // 8: targetAddress
                new TypeReference<Uint256>() {},  // 9: minTimelock
                new TypeReference<Uint256>() {},  // 10: expiresAt
                new TypeReference<Uint8>() {},    // 11: status
                new TypeReference<Address>() {},  // 12: matchedBy
                new TypeReference<Bytes32>() {}   // 13: htlcSwapId
        )));
        if (d.size() < 14) return null;
        return Map.ofEntries(
                Map.entry("id", ((Uint256)d.get(0)).getValue()),
                Map.entry("creator", ((Address)d.get(1)).getValue()),
                Map.entry("sellToken", ((Address)d.get(2)).getValue()),
                Map.entry("sellAmount", ((Uint256)d.get(3)).getValue()),
                Map.entry("buyToken", ((Address)d.get(5)).getValue()),
                Map.entry("buyAmount", ((Uint256)d.get(6)).getValue()),
                Map.entry("targetChainId", ((Uint256)d.get(7)).getValue()),
                Map.entry("targetAddress", ((Address)d.get(8)).getValue()),
                Map.entry("expiresAt", ((Uint256)d.get(10)).getValue()),
                Map.entry("status", ((Uint8)d.get(11)).getValue().intValue()),
                Map.entry("matchedBy", ((Address)d.get(12)).getValue()));
    }

    private String ethCall(Web3j web3j, String to, String data) throws Exception {
        var tx = new org.web3j.protocol.core.methods.request.Transaction(null, null, null, null, to, null, data);
        return web3j.ethCall(tx, DefaultBlockParameterName.LATEST).send().getValue();
    }

    // ── Retry helper ──────────────────────────────────────────────────────

    @FunctionalInterface
    private interface RpcCall<T> { T call() throws Exception; }

    private <T> T retryRpc(RpcCall<T> call) throws Exception {
        Exception lastError = null;
        for (int i = 0; i <= MAX_RETRIES; i++) {
            try {
                return call.call();
            } catch (Exception e) {
                lastError = e;
                if (i < MAX_RETRIES) {
                    Thread.sleep(500L * (i + 1)); // 500ms, 1000ms backoff
                }
            }
        }
        throw lastError;
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    /** Get Web3j client, invalidating cache if RPC URL changed. */
    private Web3j getWeb3j(Chain chain) {
        String cachedUrl = rpcUrlCache.get(chain.getId());
        if (cachedUrl != null && !cachedUrl.equals(chain.getRpcUrl())) {
            Web3j old = web3jCache.remove(chain.getId());
            if (old != null) old.shutdown();
            rpcUrlCache.remove(chain.getId());
        }
        rpcUrlCache.put(chain.getId(), chain.getRpcUrl());
        return web3jCache.computeIfAbsent(chain.getId(), id -> Web3j.build(new HttpService(chain.getRpcUrl())));
    }

    private Token resolveToken(String chainId, String address) {
        return address == null ? null : tokenRepo.findByChainIdAndAddressIgnoreCase(chainId, address).orElse(null);
    }

    private Token resolveTokenCrossChain(String sourceChainId, String targetChainId, String address) {
        Token token = resolveToken(targetChainId, address);
        if (token != null) return token;
        // For EVM→SUI: buyToken on-chain is a keccak256-derived EVM placeholder.
        // Reverse-lookup: find the SUI token whose type hashes to this placeholder.
        if (targetChainId != null && targetChainId.startsWith("sui") && address != null) {
            token = resolveTokenByEvmPlaceholder(targetChainId, address);
            if (token != null) return token;
        }
        return resolveToken(sourceChainId, address);
    }

    private Token resolveTokenByEvmPlaceholder(String suiChainId, String evmAddress) {
        String normalized = evmAddress.toLowerCase();
        for (Token t : tokenRepo.findByChainId(suiChainId)) {
            byte[] hash = Hash.sha3(t.getAddress().getBytes(StandardCharsets.UTF_8));
            String placeholder = "0x" + Numeric.toHexStringNoPrefix(hash).substring(0, 40);
            if (placeholder.equals(normalized)) return t;
        }
        return null;
    }

    private String resolveTargetChainId(BigInteger numericChainId) {
        if (numericChainId == null) return null;
        long id = numericChainId.longValue();
        if (id == 101 || id == 0) return "sui:testnet";
        return String.valueOf(id);
    }

    private byte[] hexToBytes32(String hex) {
        String clean = (hex.startsWith("0x") ? hex.substring(2) : hex);
        clean = String.format("%64s", clean).replace(' ', '0');
        byte[] bytes = new byte[32];
        for (int i = 0; i < 32; i++) bytes[i] = (byte) Integer.parseInt(clean.substring(i * 2, i * 2 + 2), 16);
        return bytes;
    }
}
