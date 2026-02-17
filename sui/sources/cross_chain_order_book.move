// SPDX-License-Identifier: MIT

/// Cross-Chain Order Book for discovering swap intentions across different blockchains
/// Compatible with EVM chains (Ethereum, Polygon) via consistent order structure
module dex::cross_chain_order_book {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use sui::clock::{Self, Clock};
    use sui::event;
    use std::vector;

    // ===== Error Codes =====

    const E_INVALID_EXPIRY: u64 = 1;
    const E_INVALID_AMOUNTS: u64 = 2;
    const E_SAME_CHAIN: u64 = 3;
    const E_UNSUPPORTED_CHAIN: u64 = 4;
    const E_ORDER_NOT_ACTIVE: u64 = 5;
    const E_NOT_ORDER_CREATOR: u64 = 6;
    const E_ORDER_ALREADY_MATCHED: u64 = 7;
    const E_INVALID_TIMELOCK: u64 = 8;

    // ===== Status Constants =====

    const STATUS_ACTIVE: u8 = 0;
    const STATUS_MATCHED: u8 = 1;
    const STATUS_COMPLETED: u8 = 2;
    const STATUS_CANCELLED: u8 = 3;
    const STATUS_EXPIRED: u8 = 4;

    // Minimum timelock for cross-chain swaps (1 hour)
    const MIN_TIMELOCK: u64 = 3600;

    // ===== Structs =====

    /// Order structure for cross-chain swaps
    struct Order has store, copy, drop {
        id: u64,
        creator: address,

        // What we're selling (on this chain)
        sell_token: vector<u8>,    // Token type as bytes
        sell_amount: u64,
        source_chain_id: u64,

        // What we want (on target chain)
        buy_token: vector<u8>,     // Token address on target chain
        buy_amount: u64,
        target_chain_id: u64,

        // Swap details
        target_address: address,   // Where to receive on target chain
        min_timelock: u64,         // Minimum HTLC timelock (seconds)
        expires_at: u64,           // Order expiration timestamp
        status: u8,

        // Matching info
        matched_by: address,
        htlc_swap_id: vector<u8>,  // 32 bytes - HTLC swap ID once matched
    }

    /// Shared OrderBook object
    struct OrderBook has key {
        id: UID,
        orders: Table<u64, Order>,
        next_order_id: u64,
        chain_id: u64,  // SUI chain ID (for cross-chain coordination)
        supported_chains: vector<u64>,
    }

    // ===== Events =====

    struct OrderCreated has copy, drop {
        order_id: u64,
        creator: address,
        source_chain_id: u64,
        target_chain_id: u64,
        sell_token: vector<u8>,
        sell_amount: u64,
        buy_token: vector<u8>,
        buy_amount: u64,
    }

    struct OrderMatched has copy, drop {
        order_id: u64,
        matcher: address,
        htlc_swap_id: vector<u8>,
    }

    struct OrderCompleted has copy, drop {
        order_id: u64,
    }

    struct OrderCancelled has copy, drop {
        order_id: u64,
    }

    struct OrderExpired has copy, drop {
        order_id: u64,
    }

    struct ChainAdded has copy, drop {
        chain_id: u64,
    }

    // ===== Initialization =====

    /// Initialize the OrderBook (called once on deployment)
    /// Creates a shared OrderBook with SUI testnet as default supported chain
    fun init(ctx: &mut TxContext) {
        let mut supported_chains = vector::empty<u64>();

        // Add SUI testnet chain ID
        // Note: SUI doesn't have numeric chain IDs like EVM
        // We use a placeholder value for cross-chain coordination
        let sui_chain_id = 0; // Placeholder - will be coordinated with frontend
        vector::push_back(&mut supported_chains, sui_chain_id);

        let order_book = OrderBook {
            id: object::new(ctx),
            orders: table::new(ctx),
            next_order_id: 1,
            chain_id: sui_chain_id,
            supported_chains,
        };

        transfer::share_object(order_book);
    }

    // ===== Admin Functions =====

    /// Add a supported chain (admin only - for now anyone can call)
    /// In production, would add access control
    public entry fun add_supported_chain(
        book: &mut OrderBook,
        chain_id: u64,
    ) {
        if (!vector::contains(&book.supported_chains, &chain_id)) {
            vector::push_back(&mut book.supported_chains, chain_id);
            event::emit(ChainAdded { chain_id });
        };
    }

    // ===== Order Management =====

    /// Create a cross-chain order
    /// Posts intention to swap tokens between this chain and target chain
    public entry fun create_order(
        book: &mut OrderBook,
        sell_token: vector<u8>,
        sell_amount: u64,
        buy_token: vector<u8>,
        buy_amount: u64,
        target_chain_id: u64,
        target_address: address,
        min_timelock: u64,
        expires_at: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // Validate inputs
        let current_time = clock::timestamp_ms(clock) / 1000;
        assert!(expires_at > current_time, E_INVALID_EXPIRY);
        assert!(sell_amount > 0 && buy_amount > 0, E_INVALID_AMOUNTS);
        assert!(target_chain_id != book.chain_id, E_SAME_CHAIN);
        assert!(vector::contains(&book.supported_chains, &target_chain_id), E_UNSUPPORTED_CHAIN);
        assert!(min_timelock >= MIN_TIMELOCK, E_INVALID_TIMELOCK);

        let order_id = book.next_order_id;
        book.next_order_id = order_id + 1;

        let order = Order {
            id: order_id,
            creator: tx_context::sender(ctx),
            sell_token,
            sell_amount,
            source_chain_id: book.chain_id,
            buy_token,
            buy_amount,
            target_chain_id,
            target_address,
            min_timelock,
            expires_at,
            status: STATUS_ACTIVE,
            matched_by: @0x0,
            htlc_swap_id: vector::empty(),
        };

        table::add(&mut book.orders, order_id, order);

        event::emit(OrderCreated {
            order_id,
            creator: tx_context::sender(ctx),
            source_chain_id: book.chain_id,
            target_chain_id,
            sell_token,
            sell_amount,
            buy_token,
            buy_amount,
        });
    }

    /// Match an order (indicate intention to complete the swap)
    /// Saves the HTLC swap ID for tracking
    public entry fun match_order(
        book: &mut OrderBook,
        order_id: u64,
        htlc_swap_id: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(table::contains(&book.orders, order_id), E_ORDER_NOT_ACTIVE);

        let order = table::borrow_mut(&mut book.orders, order_id);
        assert!(order.status == STATUS_ACTIVE, E_ORDER_NOT_ACTIVE);

        // Check expiration
        let current_time = clock::timestamp_ms(clock) / 1000;
        if (current_time >= order.expires_at) {
            order.status = STATUS_EXPIRED;
            event::emit(OrderExpired { order_id });
            abort E_ORDER_NOT_ACTIVE
        };

        order.status = STATUS_MATCHED;
        order.matched_by = tx_context::sender(ctx);
        order.htlc_swap_id = htlc_swap_id;

        event::emit(OrderMatched {
            order_id,
            matcher: tx_context::sender(ctx),
            htlc_swap_id,
        });
    }

    /// Mark order as completed
    /// Can be called by creator or matcher once swap is done
    public entry fun complete_order(
        book: &mut OrderBook,
        order_id: u64,
        ctx: &mut TxContext,
    ) {
        assert!(table::contains(&book.orders, order_id), E_ORDER_NOT_ACTIVE);

        let order = table::borrow_mut(&mut book.orders, order_id);
        assert!(order.status == STATUS_MATCHED, E_ORDER_NOT_ACTIVE);

        let caller = tx_context::sender(ctx);
        assert!(
            caller == order.creator || caller == order.matched_by,
            E_NOT_ORDER_CREATOR
        );

        order.status = STATUS_COMPLETED;
        event::emit(OrderCompleted { order_id });
    }

    /// Cancel an active order
    /// Only creator can cancel, and only if not matched yet
    public entry fun cancel_order(
        book: &mut OrderBook,
        order_id: u64,
        ctx: &mut TxContext,
    ) {
        assert!(table::contains(&book.orders, order_id), E_ORDER_NOT_ACTIVE);

        let order = table::borrow_mut(&mut book.orders, order_id);
        assert!(order.status == STATUS_ACTIVE, E_ORDER_NOT_ACTIVE);
        assert!(tx_context::sender(ctx) == order.creator, E_NOT_ORDER_CREATOR);

        order.status = STATUS_CANCELLED;
        event::emit(OrderCancelled { order_id });
    }

    /// Reactivate a matched order (if HTLC failed)
    /// Only creator can reactivate
    public entry fun reactivate_order(
        book: &mut OrderBook,
        order_id: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(table::contains(&book.orders, order_id), E_ORDER_NOT_ACTIVE);

        let order = table::borrow_mut(&mut book.orders, order_id);
        assert!(order.status == STATUS_MATCHED, E_ORDER_NOT_ACTIVE);
        assert!(tx_context::sender(ctx) == order.creator, E_NOT_ORDER_CREATOR);

        // Check not expired
        let current_time = clock::timestamp_ms(clock) / 1000;
        if (current_time >= order.expires_at) {
            order.status = STATUS_EXPIRED;
            event::emit(OrderExpired { order_id });
            abort E_INVALID_EXPIRY
        };

        order.status = STATUS_ACTIVE;
        order.matched_by = @0x0;
        order.htlc_swap_id = vector::empty();
    }

    // ===== View Functions =====

    /// Get order details
    public fun get_order(book: &OrderBook, order_id: u64): Order {
        *table::borrow(&book.orders, order_id)
    }

    /// Get all active orders for a target chain
    /// Note: This is expensive for large order books
    /// In production, would use indexed events instead
    public fun get_active_orders_for_target_chain(
        book: &OrderBook,
        target_chain_id: u64,
        clock: &Clock,
    ): vector<Order> {
        let mut result = vector::empty<Order>();
        let current_time = clock::timestamp_ms(clock) / 1000;

        let mut i = 1u64;
        while (i < book.next_order_id) {
            if (table::contains(&book.orders, i)) {
                let order = table::borrow(&book.orders, i);
                if (
                    order.target_chain_id == target_chain_id &&
                    order.status == STATUS_ACTIVE &&
                    order.expires_at > current_time
                ) {
                    vector::push_back(&mut result, *order);
                };
            };
            i = i + 1;
        };

        result
    }

    /// Get all orders by creator
    public fun get_orders_by_creator(
        book: &OrderBook,
        creator: address,
    ): vector<Order> {
        let mut result = vector::empty<Order>();

        let mut i = 1u64;
        while (i < book.next_order_id) {
            if (table::contains(&book.orders, i)) {
                let order = table::borrow(&book.orders, i);
                if (order.creator == creator) {
                    vector::push_back(&mut result, *order);
                };
            };
            i = i + 1;
        };

        result
    }

    /// Get supported chains
    public fun get_supported_chains(book: &OrderBook): vector<u64> {
        book.supported_chains
    }

    /// Get total order count
    public fun get_total_orders(book: &OrderBook): u64 {
        book.next_order_id - 1
    }

    /// Get chain ID
    public fun get_chain_id(book: &OrderBook): u64 {
        book.chain_id
    }

    #[test_only]
    /// Initialize for testing
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
