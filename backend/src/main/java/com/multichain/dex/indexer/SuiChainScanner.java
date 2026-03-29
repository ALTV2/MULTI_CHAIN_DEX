package com.multichain.dex.indexer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Scans SUI blockchain for order and HTLC state changes.
 * Uses SUI JSON-RPC via HTTP (through Alchemy or fullnode).
 *
 * <p>SUI data model:
 * <ul>
 *   <li>Orders stored as dynamic fields in a shared OrderBook object</li>
 *   <li>HTLC swaps are independent Move objects with status field</li>
 *   <li>Events (SwapCreated, SwapWithdrawn) track HTLC lifecycle</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SuiChainScanner implements ChainScanner {

    private final OrderRepository orderRepo;
    private final HtlcSwapRepository htlcRepo;
    private final TokenRepository tokenRepo;
    private final ChainRepository chainRepo;
    private final ObjectMapper objectMapper;

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    // SUI CCOB order status mapping
    private static final Map<Integer, OrderStatus> ORDER_STATUS_MAP = Map.of(
            0, OrderStatus.ACTIVE,
            1, OrderStatus.MATCHED,
            2, OrderStatus.COMPLETED,
            3, OrderStatus.CANCELLED,
            4, OrderStatus.EXPIRED
    );

    // SUI HTLC status mapping: 1=Active, 2=Withdrawn, 3=Refunded
    private static final Map<Integer, HtlcStatus> HTLC_STATUS_MAP = Map.of(
            1, HtlcStatus.ACTIVE,
            2, HtlcStatus.WITHDRAWN,
            3, HtlcStatus.REFUNDED
    );

    // ── ChainScanner interface ────────────────────────────────────────────

    @Override
    @Transactional
    public void scanOrders(Chain chain) {
        try {
            String ccobId = chain.getContract("ccob");
            if (ccobId != null) {
                scanSuiCcobOrders(chain, ccobId);
            }
        } catch (Exception e) {
            log.error("[SUI] Failed to scan orders", e);
        }
    }

    @Override
    @Transactional
    public void scanHtlcs(Chain chain) {
        try {
            String htlcPackage = chain.getContract("htlc");
            if (htlcPackage == null) return;

            // Scan SwapCreated events (uses its own cursor: lastEventCursor)
            scanSwapCreatedEvents(chain, htlcPackage);

            // Scan SwapWithdrawn events (uses separate cursor: lastWithdrawnCursor)
            scanSwapWithdrawnEvents(chain, htlcPackage);

            // Poll active SUI HTLCs for status changes
            List<HtlcSwap> activeHtlcs = htlcRepo.findByChainIdAndStatus(chain.getId(), HtlcStatus.ACTIVE);
            for (HtlcSwap htlc : activeHtlcs) {
                if (htlc.getSuiObjectId() == null) continue;
                try {
                    updateSuiHtlcStatus(chain, htlc);
                } catch (Exception e) {
                    log.warn("[SUI] Failed to update HTLC {}", htlc.getSuiObjectId(), e);
                }
            }

            chainRepo.save(chain);
        } catch (Exception e) {
            log.error("[SUI] Failed to scan HTLCs", e);
        }
    }

    @Override
    @Transactional
    public void processTransaction(Chain chain, String txHash) {
        try {
            // Re-scan everything to pick up changes
            scanOrders(chain);
            scanHtlcs(chain);
            log.info("[SUI] Processed tx {}", txHash);
        } catch (Exception e) {
            log.error("[SUI] Failed to process tx {}", txHash, e);
        }
    }

    // ── SUI CCOB order scanning ───────────────────────────────────────────

    private void scanSuiCcobOrders(Chain chain, String orderBookId) throws Exception {
        // 1. Get the orders table ID from the OrderBook shared object
        JsonNode obj = suiGetObject(chain, orderBookId);
        if (obj == null) return;

        JsonNode fields = obj.at("/data/content/fields");
        String tableId = fields.at("/orders/fields/id/id").asText(null);
        if (tableId == null) {
            log.warn("[SUI] OrderBook {} has no orders table", orderBookId);
            return;
        }

        // 2. List all dynamic fields (order IDs)
        JsonNode dynamicFields = suiGetDynamicFields(chain, tableId);
        if (dynamicFields == null || !dynamicFields.has("data")) return;

        // 3. Read each order
        for (JsonNode field : dynamicFields.get("data")) {
            try {
                String fieldValue = field.at("/name/value").asText(null);
                if (fieldValue == null) continue;

                JsonNode orderObj = suiGetDynamicFieldObject(chain, tableId, fieldValue);
                if (orderObj == null) continue;

                JsonNode orderFields = orderObj.at("/data/content/fields/value/fields");
                if (orderFields.isMissingNode()) continue;

                upsertSuiOrder(chain, fieldValue, orderFields);
            } catch (Exception e) {
                log.trace("[SUI] Failed to read order field", e);
            }
        }
    }

    private void upsertSuiOrder(Chain chain, String orderId, JsonNode fields) {
        var existing = orderRepo.findBySourceChain_IdAndOnChainOrderId(chain.getId(), orderId);

        int statusNum = fields.path("status").asInt(0);
        OrderStatus status = ORDER_STATUS_MAP.getOrDefault(statusNum, OrderStatus.ACTIVE);

        if (existing.isPresent() && existing.get().getStatus().isTerminal()) return;

        int targetChainId = fields.path("target_chain_id").asInt(0);
        boolean isCrossChain = targetChainId != 0;

        String sellTokenType = decodeByteArray(fields.path("sell_token"));
        String buyTokenType = decodeByteArray(fields.path("buy_token"));

        String targetChainStr = isCrossChain ? resolveTargetChainId(targetChainId) : chain.getId();

        Order order = existing.orElseGet(() -> Order.builder()
                .sourceChain(chain)
                .onChainOrderId(orderId)
                .orderType(isCrossChain ? OrderType.CROSS_CHAIN : OrderType.SAME_CHAIN)
                .creator(fields.path("creator").asText(""))
                .sellToken(resolveToken(chain.getId(), sellTokenType))
                .sellAmount(new BigInteger(fields.path("sell_amount").asText("0")))
                .buyToken(resolveToken(isCrossChain ? targetChainStr : chain.getId(), buyTokenType))
                .buyAmount(new BigInteger(fields.path("buy_amount").asText("0")))
                .targetChain(isCrossChain ? chainRepo.findById(targetChainStr).orElse(null) : null)
                .build());

        order.setStatus(status);

        // Target address
        String targetAddr = fields.path("target_address").asText(null);
        if (targetAddr != null && !targetAddr.isEmpty()) {
            order.setTargetAddress(targetAddr);
        }

        // Matcher
        String matchedBy = fields.path("matched_by").asText(null);
        if (matchedBy != null && !matchedBy.startsWith("0x00000000000000000000000000000000")) {
            if (order.getMatcher() == null) {
                order.setMatcher(matchedBy);
                order.setMatchedAt(Instant.now());
            }
        }

        // Expiration
        long expiresAt = fields.path("expires_at").asLong(0);
        if (expiresAt > 0) {
            order.setExpiresAt(Instant.ofEpochSecond(expiresAt));
        }

        if (status == OrderStatus.COMPLETED && order.getCompletedAt() == null) {
            order.setCompletedAt(Instant.now());
        }

        orderRepo.save(order);
    }

    // ── SUI HTLC event scanning ───────────────────────────────────────────

    private void scanSwapCreatedEvents(Chain chain, String htlcPackage) throws Exception {
        String eventType = htlcPackage + "::htlc::SwapCreated";
        JsonNode result = suiQueryEvents(chain, eventType, chain.getLastEventCursor());

        if (result == null || !result.has("data")) return;

        for (JsonNode event : result.get("data")) {
            try {
                JsonNode parsed = event.path("parsedJson");
                if (parsed.isMissingNode()) continue;

                String objectId = parsed.path("swap_object_id").asText(null);
                if (objectId == null) continue;

                // Check if we already have this HTLC
                if (htlcRepo.findBySuiObjectId(objectId).isPresent()) continue;

                String hashlock = bytesArrayToHex(parsed.path("hashlock"));
                String participant = parsed.path("participant").asText("");

                // Try to link to an order via hashlock
                Order linkedOrder = findOrderByHashlock(hashlock);

                if (linkedOrder != null) {
                    // Determine role: if initiator is the order creator → CREATOR htlc, else MATCHER
                    String sender = event.at("/sender").asText("");
                    HtlcRole role = sender.equalsIgnoreCase(linkedOrder.getCreator())
                            ? HtlcRole.CREATOR : HtlcRole.MATCHER;

                    // Don't create duplicate
                    if (htlcRepo.findByOrderIdAndRole(linkedOrder.getId(), role).isPresent()) continue;

                    HtlcSwap htlc = HtlcSwap.builder()
                            .order(linkedOrder)
                            .role(role)
                            .chain(chain)
                            .suiObjectId(objectId)
                            .initiator(sender)
                            .participant(participant)
                            .hashlock(hashlock)
                            .amount(new BigInteger(parsed.path("amount").asText("0")))
                            .timelock(Instant.ofEpochSecond(parsed.path("timelock").asLong(0)))
                            .status(HtlcStatus.ACTIVE)
                            .build();

                    // Resolve token
                    htlc.setToken(resolveToken(chain.getId(),
                            parsed.path("token_type").asText(null)));

                    htlcRepo.save(htlc);
                    log.info("[SUI] Discovered HTLC {} for order {} (role={})",
                            objectId, linkedOrder.getOnChainOrderId(), role);
                }
            } catch (Exception e) {
                log.trace("[SUI] Failed to process SwapCreated event", e);
            }
        }

        // Update cursor
        if (result.has("nextCursor") && !result.get("nextCursor").isNull()) {
            chain.setLastEventCursor(result.get("nextCursor").asText());
        }
    }

    private void scanSwapWithdrawnEvents(Chain chain, String htlcPackage) throws Exception {
        String eventType = htlcPackage + "::htlc::SwapWithdrawn";
        JsonNode result = suiQueryEvents(chain, eventType, chain.getLastWithdrawnCursor());

        if (result == null || !result.has("data")) return;

        for (JsonNode event : result.get("data")) {
            try {
                JsonNode parsed = event.path("parsedJson");
                String objectId = parsed.path("swap_object_id").asText(null);
                if (objectId == null) continue;

                var htlcOpt = htlcRepo.findBySuiObjectId(objectId);
                if (htlcOpt.isEmpty()) continue;

                HtlcSwap htlc = htlcOpt.get();
                if (htlc.getStatus() != HtlcStatus.ACTIVE) continue;

                String secret = bytesArrayToHex(parsed.path("secret"));
                htlc.setStatus(HtlcStatus.WITHDRAWN);
                htlc.setSecret(secret);
                htlcRepo.save(htlc);

                log.info("[SUI] HTLC {} withdrawn, secret revealed", objectId);
            } catch (Exception e) {
                log.trace("[SUI] Failed to process SwapWithdrawn event", e);
            }
        }

        // Update withdrawn cursor separately from created cursor
        if (result.has("nextCursor") && !result.get("nextCursor").isNull()) {
            chain.setLastWithdrawnCursor(result.get("nextCursor").asText());
        }
    }

    // ── SUI HTLC status polling ───────────────────────────────────────────

    private void updateSuiHtlcStatus(Chain chain, HtlcSwap htlc) throws Exception {
        JsonNode obj = suiGetObject(chain, htlc.getSuiObjectId());
        if (obj == null) return;

        JsonNode fields = obj.at("/data/content/fields");
        int statusNum = fields.path("status").asInt(1);
        HtlcStatus newStatus = HTLC_STATUS_MAP.getOrDefault(statusNum, HtlcStatus.ACTIVE);

        if (newStatus != htlc.getStatus()) {
            log.info("[SUI] HTLC {} status changed: {} → {}",
                    htlc.getSuiObjectId(), htlc.getStatus(), newStatus);
            htlc.setStatus(newStatus);
            htlcRepo.save(htlc);
        }
    }

    // ── SUI JSON-RPC helpers ──────────────────────────────────────────────

    private JsonNode suiRpc(Chain chain, String method, JsonNode params) throws Exception {
        var body = objectMapper.createObjectNode();
        body.put("jsonrpc", "2.0");
        body.put("id", 1);
        body.put("method", method);
        body.set("params", params);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(chain.getRpcUrl()))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .timeout(Duration.ofSeconds(15))
                .build();

        HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode json = objectMapper.readTree(response.body());

        if (json.has("error")) {
            log.warn("[SUI] RPC error: {}", json.get("error"));
            return null;
        }
        return json.get("result");
    }

    private JsonNode suiGetObject(Chain chain, String objectId) throws Exception {
        var params = objectMapper.createArrayNode();
        params.add(objectId);
        var options = objectMapper.createObjectNode();
        options.put("showContent", true);
        params.add(options);
        return suiRpc(chain, "sui_getObject", params);
    }

    private JsonNode suiGetDynamicFields(Chain chain, String parentId) throws Exception {
        var params = objectMapper.createArrayNode();
        params.add(parentId);
        return suiRpc(chain, "suix_getDynamicFields", params);
    }

    private JsonNode suiGetDynamicFieldObject(Chain chain, String parentId, String fieldValue) throws Exception {
        var params = objectMapper.createArrayNode();
        params.add(parentId);
        var name = objectMapper.createObjectNode();
        name.put("type", "u64");
        name.put("value", fieldValue);
        params.add(name);
        return suiRpc(chain, "suix_getDynamicFieldObject", params);
    }

    private JsonNode suiQueryEvents(Chain chain, String eventType, String cursor) throws Exception {
        var params = objectMapper.createArrayNode();
        var query = objectMapper.createObjectNode();
        query.put("MoveEventType", eventType);
        params.add(query);
        params.add(cursor != null ? objectMapper.readTree("\"" + cursor + "\"") : objectMapper.nullNode());
        params.add(50); // limit
        params.add(false); // descending = false (ascending to not miss events)
        return suiRpc(chain, "suix_queryEvents", params);
    }

    // ── Utility helpers ───────────────────────────────────────────────────

    private Token resolveToken(String chainId, String address) {
        if (address == null || address.isEmpty()) return null;
        return tokenRepo.findByChainIdAndAddressIgnoreCase(chainId, address).orElse(null);
    }

    private String resolveTargetChainId(int numericChainId) {
        if (numericChainId == 101 || numericChainId == 0) return "sui:testnet";
        return String.valueOf(numericChainId);
    }

    /** Find an order that has an HTLC with the given hashlock (indexed query, no full scan). */
    private Order findOrderByHashlock(String hashlock) {
        if (hashlock == null) return null;
        return htlcRepo.findFirstByHashlockIgnoreCase(hashlock)
                .map(HtlcSwap::getOrder)
                .orElse(null);
    }

    /** Decode a SUI byte array field (vector<u8>) to UTF-8 string. */
    private String decodeByteArray(JsonNode node) {
        if (node == null || node.isMissingNode() || !node.isArray()) return null;
        byte[] bytes = new byte[node.size()];
        for (int i = 0; i < node.size(); i++) {
            bytes[i] = (byte) node.get(i).asInt();
        }
        return new String(bytes);
    }

    /** Convert a JSON array of bytes to 0x-prefixed hex string. */
    private String bytesArrayToHex(JsonNode node) {
        if (node == null || node.isMissingNode() || !node.isArray()) return null;
        StringBuilder sb = new StringBuilder("0x");
        for (JsonNode b : node) {
            sb.append(String.format("%02x", b.asInt() & 0xFF));
        }
        return sb.toString();
    }
}
