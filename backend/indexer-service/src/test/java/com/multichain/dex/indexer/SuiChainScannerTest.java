package com.multichain.dex.indexer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.multichain.dex.TestDataBuilder;
import com.multichain.dex.domain.entity.Chain;
import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.entity.Token;
import com.multichain.dex.domain.enums.OrderType;
import com.multichain.dex.repository.ChainRepository;
import com.multichain.dex.repository.HtlcSwapRepository;
import com.multichain.dex.repository.OrderRepository;
import com.multichain.dex.repository.TokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the deterministic SUI order parsing/upsert logic with mocked
 * repositories and a {@link JsonNode} built in-memory — the JSON-RPC scanning
 * paths are verified by manual E2E (diploma §4.4.2).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SuiChainScannerTest {

    @Mock private OrderRepository orderRepo;
    @Mock private HtlcSwapRepository htlcRepo;
    @Mock private TokenRepository tokenRepo;
    @Mock private ChainRepository chainRepo;

    private final ObjectMapper mapper = new ObjectMapper();
    private SuiChainScanner scanner;
    private Chain sui;
    private Chain sepolia;
    private Token suiToken;
    private Token evmToken;

    @BeforeEach
    void setUp() {
        scanner = new SuiChainScanner(orderRepo, htlcRepo, tokenRepo, chainRepo, mapper);
        sui = TestDataBuilder.sui();
        sepolia = TestDataBuilder.sepolia();
        suiToken = TestDataBuilder.sui(sui);
        evmToken = TestDataBuilder.tka(sepolia);
    }

    private ArrayNode bytes(String s) {
        ArrayNode a = mapper.createArrayNode();
        for (byte b : s.getBytes(StandardCharsets.UTF_8)) a.add(b & 0xFF);
        return a;
    }

    @Test
    void resolveTargetChainId_mapsPlaceholdersAndNumericIds() {
        assertThat(scanner.resolveTargetChainId(101)).isEqualTo("sui:testnet");
        assertThat(scanner.resolveTargetChainId(0)).isEqualTo("sui:testnet");
        assertThat(scanner.resolveTargetChainId(11155111)).isEqualTo("11155111");
    }

    @Test
    void decodeByteArray_decodesUtf8AndHandlesMissing() {
        assertThat(scanner.decodeByteArray(bytes("0x2::sui::SUI"))).isEqualTo("0x2::sui::SUI");
        assertThat(scanner.decodeByteArray(mapper.nullNode().path("absent"))).isNull();
        assertThat(scanner.decodeByteArray(mapper.getNodeFactory().textNode("not-an-array"))).isNull();
    }

    @Test
    void upsertSuiOrder_insertsCrossChainOrderWithResolvedTargetChain() {
        when(orderRepo.findBySourceChain_IdAndOnChainOrderIdAndOrderType("sui:testnet", "7", OrderType.CROSS_CHAIN))
                .thenReturn(Optional.empty());
        when(tokenRepo.findByChainIdAndAddressIgnoreCase("sui:testnet", "0x2::sui::SUI")).thenReturn(Optional.of(suiToken));
        when(tokenRepo.findByChainIdAndAddressIgnoreCase("11155111", "0xEVMTOKEN")).thenReturn(Optional.of(evmToken));
        when(chainRepo.findById("11155111")).thenReturn(Optional.of(sepolia));

        ObjectNode fields = mapper.createObjectNode();
        fields.put("target_chain_id", 11155111);
        fields.put("status", 0);
        fields.set("sell_token", bytes("0x2::sui::SUI"));
        fields.set("buy_token", bytes("0xEVMTOKEN"));
        fields.put("creator", "0xSuiCreator");
        fields.put("sell_amount", "1000");
        fields.put("buy_amount", "500");
        fields.put("target_address", "0xEvmReceiver");
        fields.put("matched_by", "0x0000000000000000000000000000000000000000");
        fields.put("expires_at", 9_999_999_999L);

        scanner.upsertSuiOrder(sui, "7", fields);

        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepo).save(captor.capture());
        Order saved = captor.getValue();
        assertThat(saved.getOrderType()).isEqualTo(OrderType.CROSS_CHAIN);
        assertThat(saved.getCreatorSourceAddress()).isEqualTo("0xSuiCreator");
        assertThat(saved.getCreatorTargetAddress()).isEqualTo("0xEvmReceiver");
        assertThat(saved.getTargetChain()).isEqualTo(sepolia);
        assertThat(saved.getSellToken()).isEqualTo(suiToken);
        assertThat(saved.getBuyToken()).isEqualTo(evmToken);
    }

    @Test
    void upsertSuiOrder_insertsSameChainOrderAndBackfillsMatcher() {
        when(orderRepo.findBySourceChain_IdAndOnChainOrderIdAndOrderType("sui:testnet", "3", OrderType.SAME_CHAIN))
                .thenReturn(Optional.empty());
        when(tokenRepo.findByChainIdAndAddressIgnoreCase("sui:testnet", "0xA::a::A")).thenReturn(Optional.of(suiToken));
        when(tokenRepo.findByChainIdAndAddressIgnoreCase("sui:testnet", "0xB::b::B")).thenReturn(Optional.of(suiToken));

        ObjectNode fields = mapper.createObjectNode();
        fields.put("target_chain_id", 0); // same-chain
        fields.put("status", 1); // MATCHED
        fields.set("sell_token", bytes("0xA::a::A"));
        fields.set("buy_token", bytes("0xB::b::B"));
        fields.put("creator", "0xSuiCreator");
        fields.put("sell_amount", "10");
        fields.put("buy_amount", "20");
        fields.put("matched_by", "0xSuiMatcher");

        scanner.upsertSuiOrder(sui, "3", fields);

        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepo).save(captor.capture());
        Order saved = captor.getValue();
        assertThat(saved.getOrderType()).isEqualTo(OrderType.SAME_CHAIN);
        assertThat(saved.getTargetChain()).isNull();
        assertThat(saved.getMatcherSourceAddress()).isEqualTo("0xSuiMatcher");
    }
}
