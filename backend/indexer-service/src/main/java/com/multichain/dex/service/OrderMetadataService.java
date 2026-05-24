package com.multichain.dex.service;

import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.enums.OrderType;
import com.multichain.dex.dto.OrderMetadataRequest;
import com.multichain.dex.indexer.BlockchainIndexer;
import com.multichain.dex.repository.ChainRepository;
import com.multichain.dex.repository.OrderRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Attaches off-chain metadata (full target-side address + opt-in email) to an indexed order.
 *
 * <p>Because order creation is on-chain, the order may not be indexed yet when the
 * frontend submits the metadata. In that case this service forces an immediate index
 * cycle of the order's source chain (reusing {@link BlockchainIndexer#processChain},
 * which holds the indexer lock) and retries the lookup once.</p>
 */
@Slf4j
@Service
public class OrderMetadataService {

    private final OrderRepository orderRepo;
    private final ChainRepository chainRepo;
    /** Optional: null when the indexer is disabled (e.g. in tests). */
    private final BlockchainIndexer indexer;

    @Autowired
    public OrderMetadataService(OrderRepository orderRepo, ChainRepository chainRepo,
                                @Autowired(required = false) BlockchainIndexer indexer) {
        this.orderRepo = orderRepo;
        this.chainRepo = chainRepo;
        this.indexer = indexer;
    }

    /**
     * @return true if the order was found (possibly after forcing indexing) and updated.
     */
    @Transactional
    public boolean attach(OrderMetadataRequest req) {
        OrderType type = OrderType.valueOf(req.orderType().toUpperCase());

        Optional<Order> opt = orderRepo
                .findBySourceChain_IdAndOnChainOrderIdAndOrderType(req.chainId(), req.onChainOrderId(), type);

        if (opt.isEmpty() && indexer != null) {
            chainRepo.findById(req.chainId()).ifPresent(indexer::processChain);
            opt = orderRepo
                    .findBySourceChain_IdAndOnChainOrderIdAndOrderType(req.chainId(), req.onChainOrderId(), type);
        }
        if (opt.isEmpty()) {
            log.warn("Order metadata: order {}/{} ({}) not found even after forced indexing",
                    req.chainId(), req.onChainOrderId(), type);
            return false;
        }

        Order order = opt.get();
        boolean isCreator = "creator".equalsIgnoreCase(req.role());

        // First-write-wins: never overwrite an existing value. Without wallet-signature auth
        // there is no way to verify the caller owns the role, so allowing overwrites would
        // let anyone redirect another party's funds or notifications.
        if (req.targetAddress() != null && !req.targetAddress().isBlank()) {
            String existing = isCreator ? order.getCreatorTargetAddress() : order.getMatcherTargetAddress();
            if (existing == null || existing.isBlank()) {
                if (isCreator) order.setCreatorTargetAddress(req.targetAddress());
                else order.setMatcherTargetAddress(req.targetAddress());
            } else if (!existing.equalsIgnoreCase(req.targetAddress())) {
                log.warn("Rejected targetAddress overwrite for order {}/{} role={} (existing={}, requested={})",
                        req.chainId(), req.onChainOrderId(), req.role(), existing, req.targetAddress());
            }
        }
        if (req.email() != null && !req.email().isBlank()) {
            String existing = isCreator ? order.getCreatorEmail() : order.getMatcherEmail();
            if (existing == null || existing.isBlank()) {
                if (isCreator) order.setCreatorEmail(req.email());
                else order.setMatcherEmail(req.email());
            } else if (!existing.equalsIgnoreCase(req.email())) {
                log.warn("Rejected email overwrite for order {}/{} role={}",
                        req.chainId(), req.onChainOrderId(), req.role());
            }
        }
        orderRepo.save(order);
        log.info("Attached metadata to order {}/{} ({}) role={}",
                req.chainId(), req.onChainOrderId(), type, req.role());
        return true;
    }
}
