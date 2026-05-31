package com.multichain.dex.indexer;

import com.multichain.dex.domain.entity.Order;
import com.multichain.dex.domain.enums.HtlcRole;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * V-2: an HTLC must be linked to an order only if its on-chain initiator is an
 * actual party to that order. The previous code linked purely by hashlock and
 * defaulted any non-creator initiator to the MATCHER role, so an attacker who
 * created a decoy HTLC with the same (public) hashlock could be attached as the
 * order's counterparty leg — the substrate for the hashlock-collision theft.
 *
 * resolveHtlcRole() returns null for a stranger, which the scanner must treat as
 * "do not link".
 */
class EvmChainScannerLinkingTest {

    private static final String CREATOR = "0x1111111111111111111111111111111111111111";
    private static final String MATCHER = "0x2222222222222222222222222222222222222222";
    private static final String ATTACKER = "0x3333333333333333333333333333333333333333";
    // SUI-sourced order: source addresses are SUI; the matcher's EVM leg uses an EVM address.
    private static final String SUI_CREATOR = "0xaaaa000000000000000000000000000000000000000000000000000000000001";
    private static final String SUI_MATCHER = "0xbbbb000000000000000000000000000000000000000000000000000000000002";
    private static final String MATCHER_EVM = "0x4444444444444444444444444444444444444444";

    private Order matchedOrder() {
        return Order.builder()
                .creatorSourceAddress(CREATOR)
                .matcherSourceAddress(MATCHER)
                .build();
    }

    /** SUI→EVM: creator/matcher source addresses are SUI; matcher's EVM address is matcherTargetAddress. */
    private Order suiSourcedMatchedOrder() {
        return Order.builder()
                .creatorSourceAddress(SUI_CREATOR)
                .matcherSourceAddress(SUI_MATCHER)
                .matcherTargetAddress(MATCHER_EVM)
                .build();
    }

    @Test
    void creatorInitiator_mapsToCreatorRole_caseInsensitive() {
        assertEquals(HtlcRole.CREATOR,
                EvmChainScanner.resolveHtlcRole(matchedOrder(), CREATOR.toUpperCase()));
    }

    @Test
    void matcherInitiator_mapsToMatcherRole() {
        assertEquals(HtlcRole.MATCHER,
                EvmChainScanner.resolveHtlcRole(matchedOrder(), MATCHER));
    }

    @Test
    void V2_strangerInitiator_isRejected_notSilentlyLabelledMatcher() {
        // decoy HTLC (same hashlock, attacker initiator) must NOT be linked as any role
        assertNull(EvmChainScanner.resolveHtlcRole(matchedOrder(), ATTACKER));
    }

    @Test
    void matcherNotYetSet_cannotValidateMatcherLeg_rejected() {
        Order unmatched = Order.builder().creatorSourceAddress(CREATOR).build(); // matcher null
        assertNull(EvmChainScanner.resolveHtlcRole(unmatched, MATCHER));
    }

    @Test
    void suiToEvm_matcherEvmLeg_mapsToMatcherViaTargetAddress() {
        // Regression guard: for a SUI-sourced order the matcher's EVM HTLC initiator is the
        // matcher's EVM (target) address, NOT its SUI source address. Must still link as MATCHER.
        assertEquals(HtlcRole.MATCHER,
                EvmChainScanner.resolveHtlcRole(suiSourcedMatchedOrder(), MATCHER_EVM));
    }

    @Test
    void suiToEvm_strangerEvmInitiator_stillRejected() {
        assertNull(EvmChainScanner.resolveHtlcRole(suiSourcedMatchedOrder(), ATTACKER));
    }
}
