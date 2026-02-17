// SPDX-License-Identifier: MIT

/// Trade module for executing same-chain orders
/// Simplified version for SUI - order execution happens in order_book.move
/// This module provides helper functions and trade tracking
module dex::trade {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;

    // ===== Structs =====

    /// Trade record for history tracking
    struct TradeRecord has key {
        id: UID,
        order_id: u64,
        seller: address,
        buyer: address,
        sell_amount: u64,
        buy_amount: u64,
        timestamp_ms: u64,
    }

    // ===== Events =====

    struct TradeExecuted has copy, drop {
        order_id: u64,
        seller: address,
        buyer: address,
        sell_amount: u64,
        buy_amount: u64,
    }

    // ===== Public Functions =====

    /// Record a trade execution
    /// Called after successful order fill to maintain history
    public fun record_trade(
        order_id: u64,
        seller: address,
        buyer: address,
        sell_amount: u64,
        buy_amount: u64,
        timestamp_ms: u64,
        ctx: &mut TxContext,
    ) {
        let trade = TradeRecord {
            id: object::new(ctx),
            order_id,
            seller,
            buyer,
            sell_amount,
            buy_amount,
            timestamp_ms,
        };

        event::emit(TradeExecuted {
            order_id,
            seller,
            buyer,
            sell_amount,
            buy_amount,
        });

        // Transfer to buyer for record keeping
        transfer::transfer(trade, buyer);
    }

    // ===== View Functions =====

    /// Get trade details
    public fun get_trade_info(trade: &TradeRecord): (
        u64,     // order_id
        address, // seller
        address, // buyer
        u64,     // sell_amount
        u64,     // buy_amount
        u64,     // timestamp_ms
    ) {
        (
            trade.order_id,
            trade.seller,
            trade.buyer,
            trade.sell_amount,
            trade.buy_amount,
            trade.timestamp_ms,
        )
    }
}
