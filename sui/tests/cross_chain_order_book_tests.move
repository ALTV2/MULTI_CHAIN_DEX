// SPDX-License-Identifier: MIT

#[test_only]
module dex::cross_chain_order_book_tests {
    use sui::test_scenario::{Self as ts};
    use sui::clock;
    use dex::cross_chain_order_book::{Self as ccob, OrderBook};

    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;
    const TARGET_CHAIN: u64 = 11155111; // Sepolia
    const TARGET_ADDR: address = @0xBEEF;

    // Order status codes (mirror of the contract constants)
    const STATUS_ACTIVE: u8 = 0;
    const STATUS_MATCHED: u8 = 1;
    const STATUS_COMPLETED: u8 = 2;
    const STATUS_CANCELLED: u8 = 3;

    #[test]
    /// Create an active cross-chain order
    fun test_create_order() {
        let mut scenario = ts::begin(ALICE);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000); // 1000 s

        ts::next_tx(&mut scenario, ALICE);
        { ccob::init_for_testing(ts::ctx(&mut scenario)); };

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::add_supported_chain(&mut book, TARGET_CHAIN);
            ccob::create_order(
                &mut book,
                b"TKA", 1000,
                b"TKB", 500,
                TARGET_CHAIN, TARGET_ADDR,
                3600, 100000,
                &clock, ts::ctx(&mut scenario),
            );
            assert!(ccob::get_total_orders(&book) == 1, 0);
            assert!(ccob::get_order_status(&book, 1) == STATUS_ACTIVE, 1);
            ts::return_shared(book);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    /// Exercise the read-only accessors after creating one order.
    fun test_view_functions() {
        let mut scenario = ts::begin(ALICE);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);

        ts::next_tx(&mut scenario, ALICE);
        { ccob::init_for_testing(ts::ctx(&mut scenario)); };

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::add_supported_chain(&mut book, TARGET_CHAIN);
            ccob::create_order(
                &mut book, b"TKA", 1000, b"TKB", 500,
                TARGET_CHAIN, TARGET_ADDR, 3600, 100000,
                &clock, ts::ctx(&mut scenario),
            );

            // get_order returns a copy of the stored order (Order has copy+drop).
            let _order = ccob::get_order(&book, 1);

            let active = ccob::get_active_orders_for_target_chain(&book, TARGET_CHAIN, &clock);
            assert!(active.length() == 1, 0);

            let mine = ccob::get_orders_by_creator(&book, ALICE);
            assert!(mine.length() == 1, 1);

            // init seeds the SUI placeholder chain (0); the test adds TARGET_CHAIN → 2 total.
            let chains = ccob::get_supported_chains(&book);
            assert!(chains.length() == 2, 2);

            assert!(ccob::get_chain_id(&book) == 0, 3);
            assert!(ccob::get_total_orders(&book) == 1, 4);

            ts::return_shared(book);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    /// Match an active order -> Matched
    fun test_match_order() {
        let mut scenario = ts::begin(ALICE);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);

        ts::next_tx(&mut scenario, ALICE);
        { ccob::init_for_testing(ts::ctx(&mut scenario)); };

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::add_supported_chain(&mut book, TARGET_CHAIN);
            ccob::create_order(
                &mut book, b"TKA", 1000, b"TKB", 500,
                TARGET_CHAIN, TARGET_ADDR, 3600, 100000,
                &clock, ts::ctx(&mut scenario),
            );
            ts::return_shared(book);
        };

        ts::next_tx(&mut scenario, BOB);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::match_order(&mut book, 1, b"abcdefghabcdefghabcdefghabcdefgh", &clock, ts::ctx(&mut scenario));
            assert!(ccob::get_order_status(&book, 1) == STATUS_MATCHED, 0);
            ts::return_shared(book);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    /// Full happy path: create -> match -> complete
    fun test_complete_order() {
        let mut scenario = ts::begin(ALICE);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);

        ts::next_tx(&mut scenario, ALICE);
        { ccob::init_for_testing(ts::ctx(&mut scenario)); };

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::add_supported_chain(&mut book, TARGET_CHAIN);
            ccob::create_order(
                &mut book, b"TKA", 1000, b"TKB", 500,
                TARGET_CHAIN, TARGET_ADDR, 3600, 100000,
                &clock, ts::ctx(&mut scenario),
            );
            ts::return_shared(book);
        };

        ts::next_tx(&mut scenario, BOB);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::match_order(&mut book, 1, b"abcdefghabcdefghabcdefghabcdefgh", &clock, ts::ctx(&mut scenario));
            ts::return_shared(book);
        };

        ts::next_tx(&mut scenario, BOB);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::complete_order(&mut book, 1, ts::ctx(&mut scenario));
            assert!(ccob::get_order_status(&book, 1) == STATUS_COMPLETED, 0);
            ts::return_shared(book);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    /// Cancel an active order -> Cancelled
    fun test_cancel_order() {
        let mut scenario = ts::begin(ALICE);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);

        ts::next_tx(&mut scenario, ALICE);
        { ccob::init_for_testing(ts::ctx(&mut scenario)); };

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::add_supported_chain(&mut book, TARGET_CHAIN);
            ccob::create_order(
                &mut book, b"TKA", 1000, b"TKB", 500,
                TARGET_CHAIN, TARGET_ADDR, 3600, 100000,
                &clock, ts::ctx(&mut scenario),
            );
            ccob::cancel_order(&mut book, 1, ts::ctx(&mut scenario));
            assert!(ccob::get_order_status(&book, 1) == STATUS_CANCELLED, 0);
            ts::return_shared(book);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    /// Reactivate a matched order -> Active again
    fun test_reactivate_order() {
        let mut scenario = ts::begin(ALICE);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);

        ts::next_tx(&mut scenario, ALICE);
        { ccob::init_for_testing(ts::ctx(&mut scenario)); };

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::add_supported_chain(&mut book, TARGET_CHAIN);
            ccob::create_order(
                &mut book, b"TKA", 1000, b"TKB", 500,
                TARGET_CHAIN, TARGET_ADDR, 3600, 100000,
                &clock, ts::ctx(&mut scenario),
            );
            ts::return_shared(book);
        };

        ts::next_tx(&mut scenario, BOB);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::match_order(&mut book, 1, b"abcdefghabcdefghabcdefghabcdefgh", &clock, ts::ctx(&mut scenario));
            ts::return_shared(book);
        };

        // Creator reactivates the matched order back to Active
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::reactivate_order(&mut book, 1, &clock, ts::ctx(&mut scenario));
            assert!(ccob::get_order_status(&book, 1) == STATUS_ACTIVE, 0);
            ts::return_shared(book);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::cross_chain_order_book::E_ORDER_NOT_ACTIVE)]
    /// Matching an expired order is rejected (no Expired status is written)
    fun test_match_expired_order_fails() {
        let mut scenario = ts::begin(ALICE);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000); // 1000 s

        ts::next_tx(&mut scenario, ALICE);
        { ccob::init_for_testing(ts::ctx(&mut scenario)); };

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::add_supported_chain(&mut book, TARGET_CHAIN);
            // expires at 2000 s
            ccob::create_order(
                &mut book, b"TKA", 1000, b"TKB", 500,
                TARGET_CHAIN, TARGET_ADDR, 3600, 2000,
                &clock, ts::ctx(&mut scenario),
            );
            ts::return_shared(book);
        };

        // Advance clock past expiry, then attempt to match
        clock::set_for_testing(&mut clock, 3000000); // 3000 s > 2000 s
        ts::next_tx(&mut scenario, BOB);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::match_order(&mut book, 1, b"abcdefghabcdefghabcdefghabcdefgh", &clock, ts::ctx(&mut scenario));
            ts::return_shared(book);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
