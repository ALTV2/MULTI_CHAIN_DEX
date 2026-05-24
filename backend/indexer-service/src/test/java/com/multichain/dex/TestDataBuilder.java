package com.multichain.dex;

import com.multichain.dex.domain.entity.Chain;
import com.multichain.dex.domain.entity.HtlcSwap;
import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.entity.Token;
import com.multichain.dex.domain.enums.*;

import java.math.BigInteger;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Builder helpers for test data. All methods return detached entities
 * (no DB interaction) suitable for both unit and integration tests.
 */
public final class TestDataBuilder {

    public static final String SEPOLIA_ID = "11155111";
    public static final String POLYGON_ID = "80002";
    public static final String SUI_ID = "sui:testnet";
    public static final String CREATOR_ADDR = "0xcreator1111111111111111111111111111111111";
    public static final String MATCHER_ADDR = "0xmatcher2222222222222222222222222222222222";
    public static final String SUI_CREATOR = "0x0000000000000000000000000000000000000000000000000000000000000abc";
    public static final String SUI_MATCHER = "0x0000000000000000000000000000000000000000000000000000000000000def";

    private TestDataBuilder() {}

    // ── Chains ────────────────────────────────────────────────────────────

    public static Chain sepolia() {
        return Chain.builder()
                .id(SEPOLIA_ID).name("Ethereum (Sepolia)").shortName("Ethereum")
                .chainType(ChainType.EVM).rpcUrl("https://test-rpc")
                .blockExplorer("https://sepolia.etherscan.io")
                .nativeSymbol("ETH").nativeDecimals(18)
                .contracts(Map.of("orderBook", "0xOB", "htlc", "0xHTLC", "ccob", "0xCCOB"))
                .build();
    }

    public static Chain polygon() {
        return Chain.builder()
                .id(POLYGON_ID).name("Polygon (Amoy)").shortName("Polygon")
                .chainType(ChainType.EVM).rpcUrl("https://test-rpc-polygon")
                .blockExplorer("https://amoy.polygonscan.com")
                .nativeSymbol("MATIC").nativeDecimals(18)
                .contracts(Map.of("orderBook", "0xOBP", "htlc", "0xHTLCP", "ccob", "0xCCOBP"))
                .build();
    }

    public static Chain sui() {
        return Chain.builder()
                .id(SUI_ID).name("SUI (Testnet)").shortName("SUI")
                .chainType(ChainType.SUI).rpcUrl("https://test-rpc-sui")
                .nativeSymbol("SUI").nativeDecimals(9)
                .contracts(Map.of("htlc", "0xSuiHTLC", "ccob", "0xSuiCCOB"))
                .build();
    }

    // ── Tokens ────────────────────────────────────────────────────────────

    public static Token eth(Chain chain) {
        return Token.builder()
                .id(UUID.randomUUID()).chain(chain)
                .address("0x0000000000000000000000000000000000000000")
                .symbol("ETH").name("Ether").decimals(18).isNative(true)
                .build();
    }

    public static Token tka(Chain chain) {
        return Token.builder()
                .id(UUID.randomUUID()).chain(chain)
                .address("0x16eb4f1a13dC130074360a14ec5ee01632e87584")
                .symbol("TKA").name("Test Token A").decimals(18)
                .build();
    }

    public static Token tkb(Chain chain) {
        return Token.builder()
                .id(UUID.randomUUID()).chain(chain)
                .address("0xAc5dA2ccba32ec2EA81F9301fb89fb59edE44644")
                .symbol("TKB").name("Test Token B").decimals(18)
                .build();
    }

    public static Token sui(Chain chain) {
        return Token.builder()
                .id(UUID.randomUUID()).chain(chain)
                .address("0x2::sui::SUI")
                .symbol("SUI").name("SUI").decimals(9).isNative(true)
                .build();
    }

    public static Token sTka(Chain chain) {
        return Token.builder()
                .id(UUID.randomUUID()).chain(chain)
                .address("0x0e1c::test_token_a::TEST_TOKEN_A")
                .symbol("sTKA").name("SUI Test Token A").decimals(9)
                .build();
    }

    // ── Orders ────────────────────────────────────────────────────────────

    public static Order sameChainOrder(Chain chain, Token sellToken, Token buyToken) {
        return Order.builder()
                .id(UUID.randomUUID())
                .sourceChain(chain).onChainOrderId("1")
                .orderType(OrderType.SAME_CHAIN)
                .creatorSourceAddress(CREATOR_ADDR)
                .sellToken(sellToken).sellAmount(BigInteger.valueOf(1000_000_000_000_000_000L))
                .buyToken(buyToken).buyAmount(BigInteger.valueOf(500_000_000_000_000_000L))
                .status(OrderStatus.ACTIVE).phase(SwapPhase.ORDER_CREATED)
                .build();
    }

    public static Order crossChainOrder(Chain source, Chain target, Token sellToken, Token buyToken) {
        return Order.builder()
                .id(UUID.randomUUID())
                .sourceChain(source).onChainOrderId("10")
                .orderType(OrderType.CROSS_CHAIN)
                .creatorSourceAddress(CREATOR_ADDR)
                .targetChain(target)
                .creatorTargetAddress(MATCHER_ADDR)
                .sellToken(sellToken).sellAmount(BigInteger.valueOf(1000_000_000_000_000_000L))
                .buyToken(buyToken).buyAmount(BigInteger.valueOf(2000_000_000_000_000_000L))
                .status(OrderStatus.ACTIVE).phase(SwapPhase.ORDER_CREATED)
                .build();
    }

    public static Order matchedOrder(Chain source, Chain target, Token sellToken, Token buyToken) {
        Order order = crossChainOrder(source, target, sellToken, buyToken);
        order.setMatcherSourceAddress(MATCHER_ADDR);
        order.setStatus(OrderStatus.MATCHED);
        order.setPhase(SwapPhase.ORDER_MATCHED);
        order.setMatchedAt(Instant.now());
        return order;
    }

    // ── HTLCs ─────────────────────────────────────────────────────────────

    public static HtlcSwap htlc(Order order, HtlcRole role, Chain chain, HtlcStatus status) {
        return HtlcSwap.builder()
                .id(UUID.randomUUID())
                .order(order).role(role).chain(chain)
                .onChainSwapId("0x" + UUID.randomUUID().toString().replace("-", ""))
                .initiator(role == HtlcRole.CREATOR ? CREATOR_ADDR : MATCHER_ADDR)
                .participant(role == HtlcRole.CREATOR ? MATCHER_ADDR : CREATOR_ADDR)
                .hashlock("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
                .timelock(Instant.now().plusSeconds(86400))
                .status(status)
                .amount(BigInteger.valueOf(1000_000_000_000_000_000L))
                .build();
    }

    public static HtlcSwap activeHtlc(Order order, HtlcRole role, Chain chain) {
        return htlc(order, role, chain, HtlcStatus.ACTIVE);
    }

    public static HtlcSwap withdrawnHtlc(Order order, HtlcRole role, Chain chain) {
        HtlcSwap h = htlc(order, role, chain, HtlcStatus.WITHDRAWN);
        h.setSecret("0xsecret1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
        return h;
    }

    public static HtlcSwap expiredHtlc(Order order, HtlcRole role, Chain chain) {
        HtlcSwap h = htlc(order, role, chain, HtlcStatus.ACTIVE);
        h.setTimelock(Instant.now().minusSeconds(3600)); // expired 1h ago
        return h;
    }
}
