package com.multichain.dex.service;

import com.multichain.dex.domain.entity.SwapHistory;
import com.multichain.dex.domain.entity.User;
import com.multichain.dex.domain.enums.ChainType;
import com.multichain.dex.domain.enums.SwapStatus;
import com.multichain.dex.dto.request.CreateSwapRequest;
import com.multichain.dex.dto.response.SwapHistoryResponse;
import com.multichain.dex.repository.SwapHistoryRepository;
import com.multichain.dex.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class SwapService {

    private final SwapHistoryRepository swapHistoryRepository;
    private final UserRepository userRepository;

    @Transactional
    public SwapHistoryResponse createSwapRecord(UUID userId, CreateSwapRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        SwapHistory swap = SwapHistory.builder()
            .user(user)
            .sourceChain(request.getSourceChain())
            .targetChain(request.getTargetChain())
            .sourceToken(request.getSourceToken())
            .sourceAmount(request.getSourceAmount())
            .targetToken(request.getTargetToken())
            .targetAmount(request.getTargetAmount())
            .hashlock(request.getHashlock())
            .timelockExpiry(request.getTimelockExpiry())
            .status(SwapStatus.PENDING)
            .build();

        swap = swapHistoryRepository.save(swap);
        return toResponse(swap);
    }

    @Transactional
    public SwapHistoryResponse updateSwapStatus(UUID swapId, SwapStatus status, String txHash, boolean isSourceTx) {
        SwapHistory swap = swapHistoryRepository.findById(swapId)
            .orElseThrow(() -> new IllegalArgumentException("Swap not found"));

        swap.setStatus(status);

        if (txHash != null) {
            if (isSourceTx) {
                swap.setSourceTxHash(txHash);
            } else {
                swap.setTargetTxHash(txHash);
            }
        }

        if (status == SwapStatus.WITHDRAWN || status == SwapStatus.REFUNDED) {
            swap.setCompletedAt(LocalDateTime.now());
        }

        swap = swapHistoryRepository.save(swap);
        return toResponse(swap);
    }

    @Transactional
    public SwapHistoryResponse updateHtlcSwapId(UUID swapId, String htlcSwapId) {
        SwapHistory swap = swapHistoryRepository.findById(swapId)
            .orElseThrow(() -> new IllegalArgumentException("Swap not found"));

        swap.setHtlcSwapId(htlcSwapId);
        swap.setStatus(SwapStatus.HTLC_CREATED);

        swap = swapHistoryRepository.save(swap);
        return toResponse(swap);
    }

    @Transactional(readOnly = true)
    public Page<SwapHistoryResponse> getUserSwapHistory(UUID userId, Pageable pageable) {
        return swapHistoryRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
            .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public SwapHistoryResponse getSwapById(UUID swapId) {
        SwapHistory swap = swapHistoryRepository.findById(swapId)
            .orElseThrow(() -> new IllegalArgumentException("Swap not found"));
        return toResponse(swap);
    }

    @Transactional(readOnly = true)
    public SwapHistoryResponse getSwapByHtlcId(String htlcSwapId) {
        SwapHistory swap = swapHistoryRepository.findByHtlcSwapId(htlcSwapId)
            .orElseThrow(() -> new IllegalArgumentException("Swap not found"));
        return toResponse(swap);
    }

    @Transactional(readOnly = true)
    public List<SwapHistoryResponse> getActiveSwaps(UUID userId) {
        List<SwapStatus> activeStatuses = List.of(
            SwapStatus.PENDING,
            SwapStatus.HTLC_CREATED,
            SwapStatus.HTLC_MATCHED
        );

        return swapHistoryRepository.findByUserIdAndStatus(userId, SwapStatus.HTLC_CREATED).stream()
            .map(this::toResponse)
            .toList();
    }

    @Scheduled(fixedRate = 60000) // Every minute
    @Transactional
    public void checkExpiredSwaps() {
        List<SwapStatus> checkStatuses = List.of(
            SwapStatus.PENDING,
            SwapStatus.HTLC_CREATED,
            SwapStatus.HTLC_MATCHED
        );

        List<SwapHistory> expiredSwaps = swapHistoryRepository.findExpiredSwaps(
            checkStatuses, LocalDateTime.now());

        for (SwapHistory swap : expiredSwaps) {
            swap.setStatus(SwapStatus.EXPIRED);
            swapHistoryRepository.save(swap);
            log.info("Marked swap {} as expired", swap.getId());
        }
    }

    private SwapHistoryResponse toResponse(SwapHistory swap) {
        return SwapHistoryResponse.builder()
            .id(swap.getId())
            .htlcSwapId(swap.getHtlcSwapId())
            .crossChainOrderId(swap.getCrossChainOrderId())
            .sourceChain(swap.getSourceChain())
            .targetChain(swap.getTargetChain())
            .sourceToken(swap.getSourceToken())
            .sourceAmount(swap.getSourceAmount())
            .targetToken(swap.getTargetToken())
            .targetAmount(swap.getTargetAmount())
            .status(swap.getStatus())
            .sourceTxHash(swap.getSourceTxHash())
            .targetTxHash(swap.getTargetTxHash())
            .hashlock(swap.getHashlock())
            .timelockExpiry(swap.getTimelockExpiry())
            .createdAt(swap.getCreatedAt())
            .completedAt(swap.getCompletedAt())
            .build();
    }
}
