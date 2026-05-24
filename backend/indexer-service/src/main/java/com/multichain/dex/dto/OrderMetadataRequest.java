package com.multichain.dex.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * Off-chain metadata attached to an order after creation/match:
 * the full target-side address (which may not fit on-chain — e.g. a 32-byte SUI
 * address in a 20-byte EVM field) and an opt-in notification email.
 *
 * <p>The order is identified by its natural key {@code (chainId, onChainOrderId, orderType)}.
 * {@code role} selects which side's fields are written (creator or matcher).</p>
 */
public record OrderMetadataRequest(
        @NotBlank String chainId,
        @NotBlank String onChainOrderId,
        @NotBlank @Pattern(regexp = "SAME_CHAIN|CROSS_CHAIN") String orderType,
        @NotBlank @Pattern(regexp = "(?i)creator|matcher") String role,
        String targetAddress,
        @Email String email
) {}
