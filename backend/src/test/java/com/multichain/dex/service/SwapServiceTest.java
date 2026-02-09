package com.multichain.dex.service;

import com.multichain.dex.domain.entity.SwapHistory;
import com.multichain.dex.domain.entity.User;
import com.multichain.dex.domain.enums.ChainType;
import com.multichain.dex.domain.enums.SwapStatus;
import com.multichain.dex.dto.request.CreateSwapRequest;
import com.multichain.dex.dto.response.SwapHistoryResponse;
import com.multichain.dex.repository.SwapHistoryRepository;
import com.multichain.dex.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SwapServiceTest {

    @Mock
    private SwapHistoryRepository swapHistoryRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private SwapService swapService;

    private User testUser;
    private UUID userId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        testUser = User.builder()
            .id(userId)
            .primaryWalletAddress("0x1234567890abcdef1234567890abcdef12345678")
            .build();
    }

    @Nested
    @DisplayName("createSwapRecord")
    class CreateSwapRecord {

        @Test
        @DisplayName("should create swap record successfully")
        void shouldCreateSwapRecordSuccessfully() {
            // Given
            CreateSwapRequest request = new CreateSwapRequest();
            request.setSourceChain(ChainType.ETHEREUM);
            request.setTargetChain(ChainType.POLYGON);
            request.setSourceToken("0x0000000000000000000000000000000000000000");
            request.setSourceAmount(new BigDecimal("1.5"));
            request.setTargetToken("0x0000000000000000000000000000000000000000");
            request.setTargetAmount(new BigDecimal("1500"));
            request.setHashlock("0xhashlock");
            request.setTimelockExpiry(LocalDateTime.now().plusHours(48));

            SwapHistory savedSwap = SwapHistory.builder()
                .id(UUID.randomUUID())
                .user(testUser)
                .sourceChain(ChainType.ETHEREUM)
                .targetChain(ChainType.POLYGON)
                .sourceToken(request.getSourceToken())
                .sourceAmount(request.getSourceAmount())
                .targetToken(request.getTargetToken())
                .targetAmount(request.getTargetAmount())
                .hashlock(request.getHashlock())
                .timelockExpiry(request.getTimelockExpiry())
                .status(SwapStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

            when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
            when(swapHistoryRepository.save(any(SwapHistory.class))).thenReturn(savedSwap);

            // When
            SwapHistoryResponse response = swapService.createSwapRecord(userId, request);

            // Then
            assertThat(response).isNotNull();
            assertThat(response.getSourceChain()).isEqualTo(ChainType.ETHEREUM);
            assertThat(response.getTargetChain()).isEqualTo(ChainType.POLYGON);
            assertThat(response.getStatus()).isEqualTo(SwapStatus.PENDING);

            ArgumentCaptor<SwapHistory> swapCaptor = ArgumentCaptor.forClass(SwapHistory.class);
            verify(swapHistoryRepository).save(swapCaptor.capture());

            SwapHistory capturedSwap = swapCaptor.getValue();
            assertThat(capturedSwap.getUser()).isEqualTo(testUser);
            assertThat(capturedSwap.getStatus()).isEqualTo(SwapStatus.PENDING);
        }

        @Test
        @DisplayName("should throw exception when user not found")
        void shouldThrowExceptionWhenUserNotFound() {
            // Given
            CreateSwapRequest request = new CreateSwapRequest();
            when(userRepository.findById(userId)).thenReturn(Optional.empty());

            // When/Then
            assertThatThrownBy(() -> swapService.createSwapRecord(userId, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
        }
    }

    @Nested
    @DisplayName("updateSwapStatus")
    class UpdateSwapStatus {

        private UUID swapId;
        private SwapHistory existingSwap;

        @BeforeEach
        void setUp() {
            swapId = UUID.randomUUID();
            existingSwap = SwapHistory.builder()
                .id(swapId)
                .user(testUser)
                .sourceChain(ChainType.ETHEREUM)
                .targetChain(ChainType.POLYGON)
                .status(SwapStatus.HTLC_CREATED)
                .build();
        }

        @Test
        @DisplayName("should update swap status with source tx hash")
        void shouldUpdateSwapStatusWithSourceTxHash() {
            // Given
            String txHash = "0xtxhash123";
            when(swapHistoryRepository.findById(swapId)).thenReturn(Optional.of(existingSwap));
            when(swapHistoryRepository.save(any(SwapHistory.class))).thenAnswer(i -> i.getArgument(0));

            // When
            SwapHistoryResponse response = swapService.updateSwapStatus(
                swapId, SwapStatus.HTLC_MATCHED, txHash, true);

            // Then
            assertThat(response.getStatus()).isEqualTo(SwapStatus.HTLC_MATCHED);

            ArgumentCaptor<SwapHistory> swapCaptor = ArgumentCaptor.forClass(SwapHistory.class);
            verify(swapHistoryRepository).save(swapCaptor.capture());
            assertThat(swapCaptor.getValue().getSourceTxHash()).isEqualTo(txHash);
        }

        @Test
        @DisplayName("should update swap status with target tx hash")
        void shouldUpdateSwapStatusWithTargetTxHash() {
            // Given
            String txHash = "0xtargettxhash";
            when(swapHistoryRepository.findById(swapId)).thenReturn(Optional.of(existingSwap));
            when(swapHistoryRepository.save(any(SwapHistory.class))).thenAnswer(i -> i.getArgument(0));

            // When
            swapService.updateSwapStatus(swapId, SwapStatus.HTLC_MATCHED, txHash, false);

            // Then
            ArgumentCaptor<SwapHistory> swapCaptor = ArgumentCaptor.forClass(SwapHistory.class);
            verify(swapHistoryRepository).save(swapCaptor.capture());
            assertThat(swapCaptor.getValue().getTargetTxHash()).isEqualTo(txHash);
        }

        @Test
        @DisplayName("should set completedAt when status is WITHDRAWN")
        void shouldSetCompletedAtWhenWithdrawn() {
            // Given
            when(swapHistoryRepository.findById(swapId)).thenReturn(Optional.of(existingSwap));
            when(swapHistoryRepository.save(any(SwapHistory.class))).thenAnswer(i -> i.getArgument(0));

            // When
            swapService.updateSwapStatus(swapId, SwapStatus.WITHDRAWN, null, false);

            // Then
            ArgumentCaptor<SwapHistory> swapCaptor = ArgumentCaptor.forClass(SwapHistory.class);
            verify(swapHistoryRepository).save(swapCaptor.capture());
            assertThat(swapCaptor.getValue().getCompletedAt()).isNotNull();
        }

        @Test
        @DisplayName("should set completedAt when status is REFUNDED")
        void shouldSetCompletedAtWhenRefunded() {
            // Given
            when(swapHistoryRepository.findById(swapId)).thenReturn(Optional.of(existingSwap));
            when(swapHistoryRepository.save(any(SwapHistory.class))).thenAnswer(i -> i.getArgument(0));

            // When
            swapService.updateSwapStatus(swapId, SwapStatus.REFUNDED, null, false);

            // Then
            ArgumentCaptor<SwapHistory> swapCaptor = ArgumentCaptor.forClass(SwapHistory.class);
            verify(swapHistoryRepository).save(swapCaptor.capture());
            assertThat(swapCaptor.getValue().getCompletedAt()).isNotNull();
        }

        @Test
        @DisplayName("should throw exception when swap not found")
        void shouldThrowExceptionWhenSwapNotFound() {
            // Given
            when(swapHistoryRepository.findById(swapId)).thenReturn(Optional.empty());

            // When/Then
            assertThatThrownBy(() -> swapService.updateSwapStatus(swapId, SwapStatus.WITHDRAWN, null, false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Swap not found");
        }
    }

    @Nested
    @DisplayName("updateHtlcSwapId")
    class UpdateHtlcSwapId {

        @Test
        @DisplayName("should update HTLC swap ID and status")
        void shouldUpdateHtlcSwapIdAndStatus() {
            // Given
            UUID swapId = UUID.randomUUID();
            String htlcSwapId = "0xhtlcswapid123";

            SwapHistory existingSwap = SwapHistory.builder()
                .id(swapId)
                .user(testUser)
                .status(SwapStatus.PENDING)
                .build();

            when(swapHistoryRepository.findById(swapId)).thenReturn(Optional.of(existingSwap));
            when(swapHistoryRepository.save(any(SwapHistory.class))).thenAnswer(i -> i.getArgument(0));

            // When
            SwapHistoryResponse response = swapService.updateHtlcSwapId(swapId, htlcSwapId);

            // Then
            assertThat(response.getHtlcSwapId()).isEqualTo(htlcSwapId);
            assertThat(response.getStatus()).isEqualTo(SwapStatus.HTLC_CREATED);
        }
    }

    @Nested
    @DisplayName("getUserSwapHistory")
    class GetUserSwapHistory {

        @Test
        @DisplayName("should return paginated swap history")
        void shouldReturnPaginatedSwapHistory() {
            // Given
            Pageable pageable = PageRequest.of(0, 10);

            SwapHistory swap1 = SwapHistory.builder()
                .id(UUID.randomUUID())
                .user(testUser)
                .sourceChain(ChainType.ETHEREUM)
                .targetChain(ChainType.POLYGON)
                .status(SwapStatus.WITHDRAWN)
                .createdAt(LocalDateTime.now())
                .build();

            SwapHistory swap2 = SwapHistory.builder()
                .id(UUID.randomUUID())
                .user(testUser)
                .sourceChain(ChainType.POLYGON)
                .targetChain(ChainType.ETHEREUM)
                .status(SwapStatus.REFUNDED)
                .createdAt(LocalDateTime.now().minusHours(1))
                .build();

            Page<SwapHistory> swapPage = new PageImpl<>(List.of(swap1, swap2), pageable, 2);

            when(swapHistoryRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable))
                .thenReturn(swapPage);

            // When
            Page<SwapHistoryResponse> result = swapService.getUserSwapHistory(userId, pageable);

            // Then
            assertThat(result.getContent()).hasSize(2);
            assertThat(result.getTotalElements()).isEqualTo(2);
        }
    }

    @Nested
    @DisplayName("getSwapById")
    class GetSwapById {

        @Test
        @DisplayName("should return swap by ID")
        void shouldReturnSwapById() {
            // Given
            UUID swapId = UUID.randomUUID();
            SwapHistory swap = SwapHistory.builder()
                .id(swapId)
                .user(testUser)
                .sourceChain(ChainType.ETHEREUM)
                .targetChain(ChainType.POLYGON)
                .status(SwapStatus.HTLC_CREATED)
                .build();

            when(swapHistoryRepository.findById(swapId)).thenReturn(Optional.of(swap));

            // When
            SwapHistoryResponse response = swapService.getSwapById(swapId);

            // Then
            assertThat(response.getId()).isEqualTo(swapId);
            assertThat(response.getSourceChain()).isEqualTo(ChainType.ETHEREUM);
        }

        @Test
        @DisplayName("should throw exception when swap not found")
        void shouldThrowExceptionWhenSwapNotFound() {
            // Given
            UUID swapId = UUID.randomUUID();
            when(swapHistoryRepository.findById(swapId)).thenReturn(Optional.empty());

            // When/Then
            assertThatThrownBy(() -> swapService.getSwapById(swapId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Swap not found");
        }
    }

    @Nested
    @DisplayName("getSwapByHtlcId")
    class GetSwapByHtlcId {

        @Test
        @DisplayName("should return swap by HTLC ID")
        void shouldReturnSwapByHtlcId() {
            // Given
            String htlcSwapId = "0xhtlcswapid123";
            SwapHistory swap = SwapHistory.builder()
                .id(UUID.randomUUID())
                .user(testUser)
                .htlcSwapId(htlcSwapId)
                .status(SwapStatus.HTLC_CREATED)
                .build();

            when(swapHistoryRepository.findByHtlcSwapId(htlcSwapId)).thenReturn(Optional.of(swap));

            // When
            SwapHistoryResponse response = swapService.getSwapByHtlcId(htlcSwapId);

            // Then
            assertThat(response.getHtlcSwapId()).isEqualTo(htlcSwapId);
        }
    }

    @Nested
    @DisplayName("checkExpiredSwaps")
    class CheckExpiredSwaps {

        @Test
        @DisplayName("should mark expired swaps as EXPIRED")
        void shouldMarkExpiredSwapsAsExpired() {
            // Given
            SwapHistory expiredSwap = SwapHistory.builder()
                .id(UUID.randomUUID())
                .user(testUser)
                .status(SwapStatus.HTLC_CREATED)
                .timelockExpiry(LocalDateTime.now().minusHours(1))
                .build();

            when(swapHistoryRepository.findExpiredSwaps(anyList(), any(LocalDateTime.class)))
                .thenReturn(List.of(expiredSwap));
            when(swapHistoryRepository.save(any(SwapHistory.class))).thenAnswer(i -> i.getArgument(0));

            // When
            swapService.checkExpiredSwaps();

            // Then
            ArgumentCaptor<SwapHistory> swapCaptor = ArgumentCaptor.forClass(SwapHistory.class);
            verify(swapHistoryRepository).save(swapCaptor.capture());
            assertThat(swapCaptor.getValue().getStatus()).isEqualTo(SwapStatus.EXPIRED);
        }
    }
}
