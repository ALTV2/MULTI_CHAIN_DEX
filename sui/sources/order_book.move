// SPDX-License-Identifier: MIT

/// Same-chain OrderBook for trading tokens on SUI
/// Simple limit order book implementation
module dex::order_book {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;

    // ===== Error Codes =====

    const E_INVALID_AMOUNTS: u64 = 1;
    const E_ORDER_NOT_ACTIVE: u64 = 2;
    const E_NOT_ORDER_CREATOR: u64 = 3;
    const E_INSUFFICIENT_PAYMENT: u64 = 4;

    // ===== Status Constants =====

    const STATUS_ACTIVE: u8 = 0;
    const STATUS_FILLED: u8 = 1;
    const STATUS_CANCELLED: u8 = 2;

    // ===== Structs =====

    /// Generic order for selling CoinA for CoinB
    public struct Order<phantom CoinA, phantom CoinB> has key, store {
        id: UID,
        order_id: u64,
        creator: address,
        sell_balance: Balance<CoinA>,  // Coins locked for sale
        sell_amount: u64,              // Original amount
        buy_amount: u64,               // Amount to receive
        status: u8,
    }

    /// Shared OrderBook for a specific token pair
    public struct OrderBookPair<phantom CoinA, phantom CoinB> has key {
        id: UID,
        orders: Table<u64, address>,  // order_id -> Order object ID
        next_order_id: u64,
    }

    // ===== Events =====

    public struct OrderCreated has copy, drop {
        order_id: u64,
        creator: address,
        sell_amount: u64,
        buy_amount: u64,
    }

    public struct OrderFilled has copy, drop {
        order_id: u64,
        buyer: address,
    }

    public struct OrderCancelled has copy, drop {
        order_id: u64,
    }

    // ===== Initialization =====

    /// Initialize order book for a token pair
    /// Anyone can call this to create trading pair
    public entry fun init_pair<CoinA, CoinB>(ctx: &mut TxContext) {
        let order_book = OrderBookPair<CoinA, CoinB> {
            id: object::new(ctx),
            orders: table::new(ctx),
            next_order_id: 1,
        };

        transfer::share_object(order_book);
    }

    // ===== Order Management =====

    /// Create a sell order
    /// Locks CoinA and creates an order to exchange for CoinB
    public entry fun create_order<CoinA, CoinB>(
        book: &mut OrderBookPair<CoinA, CoinB>,
        payment: Coin<CoinA>,
        buy_amount: u64,
        ctx: &mut TxContext,
    ) {
        let sell_amount = coin::value(&payment);
        assert!(sell_amount > 0 && buy_amount > 0, E_INVALID_AMOUNTS);

        let order_id = book.next_order_id;
        book.next_order_id = order_id + 1;

        let order_uid = object::new(ctx);
        let order_address = object::uid_to_address(&order_uid);

        let order = Order<CoinA, CoinB> {
            id: order_uid,
            order_id,
            creator: tx_context::sender(ctx),
            sell_balance: coin::into_balance(payment),
            sell_amount,
            buy_amount,
            status: STATUS_ACTIVE,
        };

        table::add(&mut book.orders, order_id, order_address);
        transfer::share_object(order);

        event::emit(OrderCreated {
            order_id,
            creator: tx_context::sender(ctx),
            sell_amount,
            buy_amount,
        });
    }

    /// Fill an order (execute the trade)
    /// Buyer provides CoinB, receives CoinA
    public entry fun fill_order<CoinA, CoinB>(
        order: &mut Order<CoinA, CoinB>,
        payment: Coin<CoinB>,
        ctx: &mut TxContext,
    ) {
        assert!(order.status == STATUS_ACTIVE, E_ORDER_NOT_ACTIVE);
        assert!(coin::value(&payment) >= order.buy_amount, E_INSUFFICIENT_PAYMENT);

        // Mark as filled
        order.status = STATUS_FILLED;

        // Transfer sell tokens to buyer
        let sell_amount = balance::value(&order.sell_balance);
        let sell_balance = balance::split(&mut order.sell_balance, sell_amount);
        let sell_coin = coin::from_balance(sell_balance, ctx);
        transfer::public_transfer(sell_coin, tx_context::sender(ctx));

        // Transfer buy tokens to seller
        transfer::public_transfer(payment, order.creator);

        event::emit(OrderFilled {
            order_id: order.order_id,
            buyer: tx_context::sender(ctx),
        });
    }

    /// Cancel an active order
    /// Only creator can cancel, gets locked tokens back
    public entry fun cancel_order<CoinA, CoinB>(
        order: &mut Order<CoinA, CoinB>,
        ctx: &mut TxContext,
    ) {
        assert!(order.status == STATUS_ACTIVE, E_ORDER_NOT_ACTIVE);
        assert!(tx_context::sender(ctx) == order.creator, E_NOT_ORDER_CREATOR);

        order.status = STATUS_CANCELLED;

        // Return locked tokens to creator
        let sell_amount = balance::value(&order.sell_balance);
        let sell_balance = balance::split(&mut order.sell_balance, sell_amount);
        let sell_coin = coin::from_balance(sell_balance, ctx);
        transfer::public_transfer(sell_coin, order.creator);

        event::emit(OrderCancelled {
            order_id: order.order_id,
        });
    }

    // ===== View Functions =====

    /// Get order details
    public fun get_order_info<CoinA, CoinB>(order: &Order<CoinA, CoinB>): (
        u64,     // order_id
        address, // creator
        u64,     // sell_amount
        u64,     // buy_amount
        u8,      // status
    ) {
        (
            order.order_id,
            order.creator,
            order.sell_amount,
            order.buy_amount,
            order.status,
        )
    }

    /// Get total orders count
    public fun get_total_orders<CoinA, CoinB>(book: &OrderBookPair<CoinA, CoinB>): u64 {
        book.next_order_id - 1
    }

    #[test_only]
    public fun init_pair_for_testing<CoinA, CoinB>(ctx: &mut TxContext) {
        init_pair<CoinA, CoinB>(ctx);
    }
}
