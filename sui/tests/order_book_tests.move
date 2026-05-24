// SPDX-License-Identifier: MIT

#[test_only]
module dex::order_book_tests {
    use sui::test_scenario::{Self as ts};
    use sui::coin;
    use dex::order_book::{Self, OrderBookPair, Order};
    use dex::test_token_a::{Self, TEST_TOKEN_A};
    use dex::test_token_b::{Self, TEST_TOKEN_B};

    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;

    #[test]
    /// Test creating order book pair and placing an order
    fun test_create_order() {
        let mut scenario = ts::begin(ALICE);

        // Initialize tokens
        ts::next_tx(&mut scenario, ALICE);
        {
            test_token_a::init_for_testing(ts::ctx(&mut scenario));
            test_token_b::init_for_testing(ts::ctx(&mut scenario));
        };

        // Initialize order book
        ts::next_tx(&mut scenario, ALICE);
        {
            order_book::init_pair_for_testing<TEST_TOKEN_A, TEST_TOKEN_B>(ts::ctx(&mut scenario));
        };

        // Alice creates an order
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBookPair<TEST_TOKEN_A, TEST_TOKEN_B>>(&scenario);
            let payment = coin::mint_for_testing<TEST_TOKEN_A>(1000, ts::ctx(&mut scenario));

            order_book::create_order<TEST_TOKEN_A, TEST_TOKEN_B>(
                &mut book,
                payment,
                500, // wants 500 TKB for 1000 TKA
                ts::ctx(&mut scenario),
            );

            let total_orders = order_book::get_total_orders(&book);
            assert!(total_orders == 1, 0);

            ts::return_shared(book);
        };

        ts::end(scenario);
    }

    #[test]
    /// Test filling an order
    fun test_fill_order() {
        let mut scenario = ts::begin(ALICE);

        // Initialize tokens
        ts::next_tx(&mut scenario, ALICE);
        {
            test_token_a::init_for_testing(ts::ctx(&mut scenario));
            test_token_b::init_for_testing(ts::ctx(&mut scenario));
        };

        // Initialize order book
        ts::next_tx(&mut scenario, ALICE);
        {
            order_book::init_pair_for_testing<TEST_TOKEN_A, TEST_TOKEN_B>(ts::ctx(&mut scenario));
        };

        // Alice creates an order
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBookPair<TEST_TOKEN_A, TEST_TOKEN_B>>(&scenario);
            let payment = coin::mint_for_testing<TEST_TOKEN_A>(1000, ts::ctx(&mut scenario));

            order_book::create_order<TEST_TOKEN_A, TEST_TOKEN_B>(
                &mut book,
                payment,
                500,
                ts::ctx(&mut scenario),
            );

            ts::return_shared(book);
        };

        // Bob fills the order
        ts::next_tx(&mut scenario, BOB);
        {
            let mut order = ts::take_shared<Order<TEST_TOKEN_A, TEST_TOKEN_B>>(&scenario);
            let payment = coin::mint_for_testing<TEST_TOKEN_B>(500, ts::ctx(&mut scenario));

            order_book::fill_order<TEST_TOKEN_A, TEST_TOKEN_B>(
                &mut order,
                payment,
                ts::ctx(&mut scenario),
            );

            // Check order status
            let (_, _, _, _, status) = order_book::get_order_info(&order);
            assert!(status == 1, 0); // STATUS_FILLED

            ts::return_shared(order);
        };

        // Bob should receive TKA
        ts::next_tx(&mut scenario, BOB);
        {
            let received = ts::take_from_sender<coin::Coin<TEST_TOKEN_A>>(&scenario);
            assert!(coin::value(&received) == 1000, 0);
            ts::return_to_sender(&scenario, received);
        };

        // Alice should receive TKB
        ts::next_tx(&mut scenario, ALICE);
        {
            let received = ts::take_from_sender<coin::Coin<TEST_TOKEN_B>>(&scenario);
            assert!(coin::value(&received) == 500, 0);
            ts::return_to_sender(&scenario, received);
        };

        ts::end(scenario);
    }

    #[test]
    /// Test cancelling an order
    fun test_cancel_order() {
        let mut scenario = ts::begin(ALICE);

        // Initialize tokens
        ts::next_tx(&mut scenario, ALICE);
        {
            test_token_a::init_for_testing(ts::ctx(&mut scenario));
            test_token_b::init_for_testing(ts::ctx(&mut scenario));
        };

        // Initialize order book
        ts::next_tx(&mut scenario, ALICE);
        {
            order_book::init_pair_for_testing<TEST_TOKEN_A, TEST_TOKEN_B>(ts::ctx(&mut scenario));
        };

        // Alice creates an order
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBookPair<TEST_TOKEN_A, TEST_TOKEN_B>>(&scenario);
            let payment = coin::mint_for_testing<TEST_TOKEN_A>(1000, ts::ctx(&mut scenario));

            order_book::create_order<TEST_TOKEN_A, TEST_TOKEN_B>(
                &mut book,
                payment,
                500,
                ts::ctx(&mut scenario),
            );

            ts::return_shared(book);
        };

        // Alice cancels the order
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut order = ts::take_shared<Order<TEST_TOKEN_A, TEST_TOKEN_B>>(&scenario);

            order_book::cancel_order<TEST_TOKEN_A, TEST_TOKEN_B>(
                &mut order,
                ts::ctx(&mut scenario),
            );

            // Check status
            let (_, _, _, _, status) = order_book::get_order_info(&order);
            assert!(status == 2, 0); // STATUS_CANCELLED

            ts::return_shared(order);
        };

        // Alice should get tokens back
        ts::next_tx(&mut scenario, ALICE);
        {
            let received = ts::take_from_sender<coin::Coin<TEST_TOKEN_A>>(&scenario);
            assert!(coin::value(&received) == 1000, 0);
            ts::return_to_sender(&scenario, received);
        };

        ts::end(scenario);
    }
}
