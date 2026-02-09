package com.multichain.dex.repository;

import com.multichain.dex.domain.entity.SwapHistory;
import com.multichain.dex.domain.entity.User;
import com.multichain.dex.domain.enums.ChainType;
import com.multichain.dex.domain.enums.SwapStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class SwapHistoryRepositoryTest {

    @Autowired
    private SwapHistoryRepository swapHistoryRepository;

    @Autowired
    private UserRepository userRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        swapHistoryRepository.deleteAll();
        userRepository.deleteAll();

        testUser = User.builder()
            .primaryWalletAddress("0x1234567890abcdef1234567890abcdef12345678")
            .build();
        testUser = userRepository.save(testUser);
    }

    @Test
    @DisplayName("should save and find swap history by ID")
    void shouldSaveAndFindSwapHistoryById() {
        // Given
        SwapHistory swap = createTestSwap(SwapStatus.PENDING);
        swap = swapHistoryRepository.save(swap);

        // When
        Optional<SwapHistory> found = swapHistoryRepository.findById(swap.getId());

        // Then
        assertThat(found).isPresent();
        assertThat(found.get().getSourceChain()).isEqualTo(ChainType.ETHEREUM);
        assertThat(found.get().getTargetChain()).isEqualTo(ChainType.POLYGON);
    }

    @Test
    @DisplayName("should find swap by HTLC swap ID")
    void shouldFindSwapByHtlcSwapId() {
        // Given
        String htlcSwapId = "0xhtlcswapid123456";
        SwapHistory swap = createTestSwap(SwapStatus.HTLC_CREATED);
        swap.setHtlcSwapId(htlcSwapId);
        swapHistoryRepository.save(swap);

        // When
        Optional<SwapHistory> found = swapHistoryRepository.findByHtlcSwapId(htlcSwapId);

        // Then
        assertThat(found).isPresent();
        assertThat(found.get().getHtlcSwapId()).isEqualTo(htlcSwapId);
    }

    @Test
    @DisplayName("should find swaps by user ID ordered by created at desc")
    void shouldFindSwapsByUserIdOrderedByCreatedAtDesc() {
        // Given
        SwapHistory swap1 = createTestSwap(SwapStatus.PENDING);
        swap1.setCreatedAt(LocalDateTime.now().minusHours(2));
        swapHistoryRepository.save(swap1);

        SwapHistory swap2 = createTestSwap(SwapStatus.WITHDRAWN);
        swap2.setCreatedAt(LocalDateTime.now().minusHours(1));
        swapHistoryRepository.save(swap2);

        SwapHistory swap3 = createTestSwap(SwapStatus.HTLC_CREATED);
        swap3.setCreatedAt(LocalDateTime.now());
        swapHistoryRepository.save(swap3);

        // When
        Page<SwapHistory> result = swapHistoryRepository.findByUserIdOrderByCreatedAtDesc(
            testUser.getId(), PageRequest.of(0, 10));

        // Then
        assertThat(result.getContent()).hasSize(3);
        assertThat(result.getContent().get(0).getStatus()).isEqualTo(SwapStatus.HTLC_CREATED);
        assertThat(result.getContent().get(1).getStatus()).isEqualTo(SwapStatus.WITHDRAWN);
        assertThat(result.getContent().get(2).getStatus()).isEqualTo(SwapStatus.PENDING);
    }

    @Test
    @DisplayName("should find swaps by user ID and status")
    void shouldFindSwapsByUserIdAndStatus() {
        // Given
        SwapHistory swap1 = createTestSwap(SwapStatus.HTLC_CREATED);
        swapHistoryRepository.save(swap1);

        SwapHistory swap2 = createTestSwap(SwapStatus.HTLC_CREATED);
        swapHistoryRepository.save(swap2);

        SwapHistory swap3 = createTestSwap(SwapStatus.WITHDRAWN);
        swapHistoryRepository.save(swap3);

        // When
        List<SwapHistory> result = swapHistoryRepository.findByUserIdAndStatus(
            testUser.getId(), SwapStatus.HTLC_CREATED);

        // Then
        assertThat(result).hasSize(2);
        assertThat(result).allMatch(s -> s.getStatus() == SwapStatus.HTLC_CREATED);
    }

    @Test
    @DisplayName("should find expired swaps")
    void shouldFindExpiredSwaps() {
        // Given
        SwapHistory expiredSwap = createTestSwap(SwapStatus.HTLC_CREATED);
        expiredSwap.setTimelockExpiry(LocalDateTime.now().minusHours(1));
        swapHistoryRepository.save(expiredSwap);

        SwapHistory activeSwap = createTestSwap(SwapStatus.HTLC_CREATED);
        activeSwap.setTimelockExpiry(LocalDateTime.now().plusHours(1));
        swapHistoryRepository.save(activeSwap);

        SwapHistory completedSwap = createTestSwap(SwapStatus.WITHDRAWN);
        completedSwap.setTimelockExpiry(LocalDateTime.now().minusHours(1));
        swapHistoryRepository.save(completedSwap);

        List<SwapStatus> checkStatuses = List.of(
            SwapStatus.PENDING,
            SwapStatus.HTLC_CREATED,
            SwapStatus.HTLC_MATCHED
        );

        // When
        List<SwapHistory> result = swapHistoryRepository.findExpiredSwaps(
            checkStatuses, LocalDateTime.now());

        // Then
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getTimelockExpiry()).isBefore(LocalDateTime.now());
        assertThat(result.get(0).getStatus()).isEqualTo(SwapStatus.HTLC_CREATED);
    }

    @Test
    @DisplayName("should count swaps by user and status")
    void shouldCountSwapsByUserAndStatus() {
        // Given
        SwapHistory swap1 = createTestSwap(SwapStatus.HTLC_CREATED);
        swapHistoryRepository.save(swap1);

        SwapHistory swap2 = createTestSwap(SwapStatus.HTLC_CREATED);
        swapHistoryRepository.save(swap2);

        SwapHistory swap3 = createTestSwap(SwapStatus.WITHDRAWN);
        swapHistoryRepository.save(swap3);

        // When
        long htlcCreatedCount = swapHistoryRepository.countByUserIdAndStatus(
            testUser.getId(), SwapStatus.HTLC_CREATED);
        long withdrawnCount = swapHistoryRepository.countByUserIdAndStatus(
            testUser.getId(), SwapStatus.WITHDRAWN);

        // Then
        assertThat(htlcCreatedCount).isEqualTo(2);
        assertThat(withdrawnCount).isEqualTo(1);
    }

    private SwapHistory createTestSwap(SwapStatus status) {
        return SwapHistory.builder()
            .user(testUser)
            .sourceChain(ChainType.ETHEREUM)
            .targetChain(ChainType.POLYGON)
            .sourceToken("0x0000000000000000000000000000000000000000")
            .sourceAmount(new BigDecimal("1.5"))
            .targetToken("0x0000000000000000000000000000000000000000")
            .targetAmount(new BigDecimal("1500"))
            .status(status)
            .hashlock("0xhashlock123")
            .timelockExpiry(LocalDateTime.now().plusHours(24))
            .build();
    }
}
