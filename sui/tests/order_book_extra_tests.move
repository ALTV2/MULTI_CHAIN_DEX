// SPDX-License-Identifier: MIT

/// Additional same-chain OrderBook coverage: amount validation, payment sufficiency, owner-only
/// cancel, status guards, and a regression marker for the V-7 overpayment behaviour.
#[test_only]
module dex::order_book_extra_tests {
    use sui::test_scenario::{Self as ts};
    use sui::coin;
    use dex::order_book::{Self, OrderBookPair, Order};
    use dex::test_token_a::{Self, TEST_TOKEN_A};
    use dex::test_token_b::{Self, TEST_TOKEN_B};

    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;

    fun setup(scenario: &mut ts::Scenario) {
        ts::next_tx(scenario, ALICE);
        {
            test_token_a::init_for_testing(ts::ctx(scenario));
            test_token_b::init_for_testing(ts::ctx(scenario));
        };
        ts::next_tx(scenario, ALICE);
        { order_book::init_pair_for_testing<TEST_TOKEN_A, TEST_TOKEN_B>(ts::ctx(scenario)); };
    }

    fun create_order(scenario: &mut ts::Scenario, sell: u64, buy: u64) {
        ts::next_tx(scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBookPair<TEST_TOKEN_A, TEST_TOKEN_B>>(scenario);
            let payment = coin::mint_for_testing<TEST_TOKEN_A>(sell, ts::ctx(scenario));
            order_book::create_order<TEST_TOKEN_A, TEST_TOKEN_B>(&mut book, payment, buy, ts::ctx(scenario));
            ts::return_shared(book);
        };
    }

    #[test]
    #[expected_failure(abort_code = dex::order_book::E_INVALID_AMOUNTS)]
    /// A zero buy_amount is rejected.
    fun test_create_zero_buy_fails() {
        let mut scenario = ts::begin(ALICE);
        setup(&mut scenario);
        create_order(&mut scenario, 1000, 0);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::order_book::E_INVALID_AMOUNTS)]
    /// A zero-value sell coin is rejected.
    fun test_create_zero_sell_fails() {
        let mut scenario = ts::begin(ALICE);
        setup(&mut scenario);
        create_order(&mut scenario, 0, 500);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::order_book::E_INSUFFICIENT_PAYMENT)]
    /// Filling with less than buy_amount is rejected.
    fun test_fill_insufficient_payment_fails() {
        let mut scenario = ts::begin(ALICE);
        setup(&mut scenario);
        create_order(&mut scenario, 1000, 500);
        ts::next_tx(&mut scenario, BOB);
        {
            let mut order = ts::take_shared<Order<TEST_TOKEN_A, TEST_TOKEN_B>>(&scenario);
            let payment = coin::mint_for_testing<TEST_TOKEN_B>(499, ts::ctx(&mut scenario)); // short by 1
            order_book::fill_order<TEST_TOKEN_A, TEST_TOKEN_B>(&mut order, payment, ts::ctx(&mut scenario));
            ts::return_shared(order);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::order_book::E_ORDER_NOT_ACTIVE)]
    /// An order cannot be filled twice.
    fun test_fill_already_filled_fails() {
        let mut scenario = ts::begin(ALICE);
        setup(&mut scenario);
        create_order(&mut scenario, 1000, 500);
        ts::next_tx(&mut scenario, BOB);
        {
            let mut order = ts::take_shared<Order<TEST_TOKEN_A, TEST_TOKEN_B>>(&scenario);
            let payment = coin::mint_for_testing<TEST_TOKEN_B>(500, ts::ctx(&mut scenario));
            order_book::fill_order<TEST_TOKEN_A, TEST_TOKEN_B>(&mut order, payment, ts::ctx(&mut scenario));
            ts::return_shared(order);
        };
        ts::next_tx(&mut scenario, BOB);
        {
            let mut order = ts::take_shared<Order<TEST_TOKEN_A, TEST_TOKEN_B>>(&scenario);
            let payment = coin::mint_for_testing<TEST_TOKEN_B>(500, ts::ctx(&mut scenario));
            order_book::fill_order<TEST_TOKEN_A, TEST_TOKEN_B>(&mut order, payment, ts::ctx(&mut scenario)); // already filled
            ts::return_shared(order);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::order_book::E_NOT_ORDER_CREATOR)]
    /// Only the creator may cancel their order.
    fun test_cancel_not_creator_fails() {
        let mut scenario = ts::begin(ALICE);
        setup(&mut scenario);
        create_order(&mut scenario, 1000, 500);
        ts::next_tx(&mut scenario, BOB); // not the creator
        {
            let mut order = ts::take_shared<Order<TEST_TOKEN_A, TEST_TOKEN_B>>(&scenario);
            order_book::cancel_order<TEST_TOKEN_A, TEST_TOKEN_B>(&mut order, ts::ctx(&mut scenario));
            ts::return_shared(order);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::order_book::E_ORDER_NOT_ACTIVE)]
    /// A filled order can no longer be cancelled.
    fun test_cancel_filled_order_fails() {
        let mut scenario = ts::begin(ALICE);
        setup(&mut scenario);
        create_order(&mut scenario, 1000, 500);
        ts::next_tx(&mut scenario, BOB);
        {
            let mut order = ts::take_shared<Order<TEST_TOKEN_A, TEST_TOKEN_B>>(&scenario);
            let payment = coin::mint_for_testing<TEST_TOKEN_B>(500, ts::ctx(&mut scenario));
            order_book::fill_order<TEST_TOKEN_A, TEST_TOKEN_B>(&mut order, payment, ts::ctx(&mut scenario));
            ts::return_shared(order);
        };
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut order = ts::take_shared<Order<TEST_TOKEN_A, TEST_TOKEN_B>>(&scenario);
            order_book::cancel_order<TEST_TOKEN_A, TEST_TOKEN_B>(&mut order, ts::ctx(&mut scenario)); // not active
            ts::return_shared(order);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::order_book::E_ORDER_NOT_ACTIVE)]
    /// A cancelled order can no longer be filled.
    fun test_fill_cancelled_order_fails() {
        let mut scenario = ts::begin(ALICE);
        setup(&mut scenario);
        create_order(&mut scenario, 1000, 500);
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut order = ts::take_shared<Order<TEST_TOKEN_A, TEST_TOKEN_B>>(&scenario);
            order_book::cancel_order<TEST_TOKEN_A, TEST_TOKEN_B>(&mut order, ts::ctx(&mut scenario));
            ts::return_shared(order);
        };
        ts::next_tx(&mut scenario, BOB);
        {
            let mut order = ts::take_shared<Order<TEST_TOKEN_A, TEST_TOKEN_B>>(&scenario);
            let payment = coin::mint_for_testing<TEST_TOKEN_B>(500, ts::ctx(&mut scenario));
            order_book::fill_order<TEST_TOKEN_A, TEST_TOKEN_B>(&mut order, payment, ts::ctx(&mut scenario)); // cancelled
            ts::return_shared(order);
        };
        ts::end(scenario);
    }

    #[test]
    /// V-7 regression marker (documents CURRENT behaviour, not desired): fill_order forwards the
    /// ENTIRE payment to the seller, so an overpayment is NOT refunded to the buyer. When V-7 is
    /// fixed (see docs/FUTURE_WORK.md), the seller should receive exactly buy_amount and the buyer
    /// should get the 100-unit remainder back — update this test then.
    fun test_v7_overpayment_currently_not_refunded() {
        let mut scenario = ts::begin(ALICE);
        setup(&mut scenario);
        create_order(&mut scenario, 1000, 500); // wants 500 TKB
        ts::next_tx(&mut scenario, BOB);
        {
            let mut order = ts::take_shared<Order<TEST_TOKEN_A, TEST_TOKEN_B>>(&scenario);
            let payment = coin::mint_for_testing<TEST_TOKEN_B>(600, ts::ctx(&mut scenario)); // overpay by 100
            order_book::fill_order<TEST_TOKEN_A, TEST_TOKEN_B>(&mut order, payment, ts::ctx(&mut scenario));
            ts::return_shared(order);
        };
        // Buyer receives the sell side (1000 TKA) but NO TKB refund.
        ts::next_tx(&mut scenario, BOB);
        {
            let received_a = ts::take_from_sender<coin::Coin<TEST_TOKEN_A>>(&scenario);
            assert!(coin::value(&received_a) == 1000, 0);
            ts::return_to_sender(&scenario, received_a);
            assert!(!ts::has_most_recent_for_sender<coin::Coin<TEST_TOKEN_B>>(&scenario), 1); // no refund
        };
        // Seller receives the full 600 TKB (overpaid), not just 500.
        ts::next_tx(&mut scenario, ALICE);
        {
            let received_b = ts::take_from_sender<coin::Coin<TEST_TOKEN_B>>(&scenario);
            assert!(coin::value(&received_b) == 600, 2);
            ts::return_to_sender(&scenario, received_b);
        };
        ts::end(scenario);
    }
}
