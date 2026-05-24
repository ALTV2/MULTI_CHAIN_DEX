package com.multichain.dex.indexer;

import com.multichain.dex.TestDataBuilder;
import com.multichain.dex.domain.entity.Chain;
import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.entity.Token;
import com.multichain.dex.domain.enums.OrderStatus;
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

import java.math.BigInteger;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the deterministic order-upsert logic of {@link EvmChainScanner}
 * with mocked repositories — the network-I/O scanning paths are verified by manual
 * E2E (diploma §4.4.2).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class EvmChainScannerTest {

    @Mock private OrderRepository orderRepo;
    @Mock private HtlcSwapRepository htlcRepo;
    @Mock private TokenRepository tokenRepo;
    @Mock private ChainRepository chainRepo;

    private EvmChainScanner scanner;
    private Chain sepolia;
    private Chain sui;
    private Token tka;
    private Token tkb;
    private Token suiToken;

    @BeforeEach
    void setUp() {
        scanner = new EvmChainScanner(orderRepo, htlcRepo, tokenRepo, chainRepo);
        sepolia = TestDataBuilder.sepolia();
        sui = TestDataBuilder.sui();
        tka = TestDataBuilder.tka(sepolia);
        tkb = TestDataBuilder.tkb(sepolia);
        suiToken = TestDataBuilder.sui(sui);
    }

    @Test
    void resolveTargetChainId_mapsSuiPlaceholdersAndNumericIds() {
        assertThat(scanner.resolveTargetChainId(BigInteger.valueOf(101))).isEqualTo("sui:testnet");
        assertThat(scanner.resolveTargetChainId(BigInteger.ZERO)).isEqualTo("sui:testnet");
        assertThat(scanner.resolveTargetChainId(BigInteger.valueOf(11155111))).isEqualTo("11155111");
        assertThat(scanner.resolveTargetChainId(null)).isNull();
    }

    @Test
    void upsertSameChainOrder_insertsNewActiveOrder() {
        when(orderRepo.findBySourceChain_IdAndOnChainOrderIdAndOrderType("11155111", "1", OrderType.SAME_CHAIN))
                .thenReturn(Optional.empty());
        when(tokenRepo.findByChainIdAndAddressIgnoreCase("11155111", "0xTKA")).thenReturn(Optional.of(tka));
        when(tokenRepo.findByChainIdAndAddressIgnoreCase("11155111", "0xTKB")).thenReturn(Optional.of(tkb));

        Map<String, Object> data = Map.of(
                "status", 0,
                "creator", "0xCreator",
                "tokenToSell", "0xTKA",
                "sellAmount", BigInteger.valueOf(1000),
                "tokenToBuy", "0xTKB",
                "buyAmount", BigInteger.valueOf(500)
        );
        scanner.upsertSameChainOrder(sepolia, "1", data);

        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepo).save(captor.capture());
        Order saved = captor.getValue();
        assertThat(saved.getCreatorSourceAddress()).isEqualTo("0xCreator");
        assertThat(saved.getOrderType()).isEqualTo(OrderType.SAME_CHAIN);
        assertThat(saved.getStatus()).isEqualTo(OrderStatus.ACTIVE);
        assertThat(saved.getSellToken()).isEqualTo(tka);
        assertThat(saved.getBuyToken()).isEqualTo(tkb);
    }

    @Test
    void upsertSameChainOrder_skipsTerminalOrders() {
        Order completed = TestDataBuilder.sameChainOrder(sepolia, tka, tkb);
        completed.setStatus(OrderStatus.COMPLETED);
        when(orderRepo.findBySourceChain_IdAndOnChainOrderIdAndOrderType("11155111", "1", OrderType.SAME_CHAIN))
                .thenReturn(Optional.of(completed));

        scanner.upsertSameChainOrder(sepolia, "1", Map.of(
                "status", 0, "creator", "0xC", "tokenToSell", "0xTKA",
                "sellAmount", BigInteger.ONE, "tokenToBuy", "0xTKB", "buyAmount", BigInteger.ONE));

        verify(orderRepo, never()).save(any());
    }

    @Test
    void upsertCrossChainOrder_insertsWithTargetAddressAndResolvesSuiChain() {
        when(orderRepo.findBySourceChain_IdAndOnChainOrderIdAndOrderType("11155111", "10", OrderType.CROSS_CHAIN))
                .thenReturn(Optional.empty());
        when(tokenRepo.findByChainIdAndAddressIgnoreCase("11155111", "0xTKA")).thenReturn(Optional.of(tka));
        when(tokenRepo.findByChainIdAndAddressIgnoreCase("sui:testnet", "0xSUI")).thenReturn(Optional.of(suiToken));
        when(chainRepo.findById("sui:testnet")).thenReturn(Optional.of(sui));

        Map<String, Object> data = Map.of(
                "status", 0,
                "creator", "0xCreator",
                "sellToken", "0xTKA",
                "sellAmount", BigInteger.valueOf(1000),
                "buyToken", "0xSUI",
                "buyAmount", BigInteger.valueOf(500),
                "targetChainId", BigInteger.valueOf(101),
                "targetAddress", "0xTRUNCATED",
                "matchedBy", "0x0000000000000000000000000000000000000000",
                "expiresAt", BigInteger.valueOf(9_999_999_999L)
        );
        scanner.upsertCrossChainOrder(sepolia, "10", data);

        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepo).save(captor.capture());
        Order saved = captor.getValue();
        assertThat(saved.getOrderType()).isEqualTo(OrderType.CROSS_CHAIN);
        assertThat(saved.getCreatorTargetAddress()).isEqualTo("0xTRUNCATED");
        assertThat(saved.getTargetChain()).isEqualTo(sui);
        assertThat(saved.getMatcherSourceAddress()).isNull(); // zero matchedBy → not set
    }

    @Test
    void upsertCrossChainOrder_doesNotClobberOffChainTargetAddress_andBackfillsMatcher() {
        // An order already carrying the full off-chain SUI address (written via /orders/metadata).
        Order existing = TestDataBuilder.crossChainOrder(sepolia, sui, tka, suiToken);
        existing.setCreatorTargetAddress("0xFULL_SUI_ADDRESS_64_HEX");
        existing.setStatus(OrderStatus.ACTIVE);
        when(orderRepo.findBySourceChain_IdAndOnChainOrderIdAndOrderType("11155111", "10", OrderType.CROSS_CHAIN))
                .thenReturn(Optional.of(existing));

        Map<String, Object> data = Map.of(
                "status", 1, // MATCHED
                "creator", "0xCreator",
                "sellToken", "0xTKA",
                "sellAmount", BigInteger.valueOf(1000),
                "buyToken", "0xSUI",
                "buyAmount", BigInteger.valueOf(500),
                "targetChainId", BigInteger.valueOf(101),
                "targetAddress", "0xTRUNCATED",
                "matchedBy", "0xBob",
                "expiresAt", BigInteger.valueOf(9_999_999_999L)
        );
        scanner.upsertCrossChainOrder(sepolia, "10", data);

        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepo).save(captor.capture());
        Order saved = captor.getValue();
        assertThat(saved.getCreatorTargetAddress()).isEqualTo("0xFULL_SUI_ADDRESS_64_HEX"); // not clobbered
        assertThat(saved.getStatus()).isEqualTo(OrderStatus.MATCHED);
        assertThat(saved.getMatcherSourceAddress()).isEqualTo("0xBob"); // backfilled
    }
}
