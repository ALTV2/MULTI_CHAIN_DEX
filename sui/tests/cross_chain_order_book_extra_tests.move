// SPDX-License-Identifier: MIT

/// Additional cross-chain OrderBook coverage: create-time validation (expiry, amounts, same-chain,
/// unsupported chain, min timelock), status guards on match/complete/cancel/reactivate, the
/// creator-completes happy path, and a regression marker for the missing add_supported_chain
/// access control (see docs/FUTURE_WORK.md).
#[test_only]
module dex::ccob_extra_tests {
    use sui::test_scenario::{Self as ts};
    use sui::clock::{Self, Clock};
    use dex::cross_chain_order_book::{Self as ccob, OrderBook};

    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;
    const CAROL: address = @0xCA401;
    const TARGET_CHAIN: u64 = 11155111; // Sepolia
    const TARGET_ADDR: address = @0xBEEF;
    const STATUS_COMPLETED: u8 = 2;
    const HTLC_ID: vector<u8> = b"abcdefghabcdefghabcdefghabcdefgh"; // 32 bytes

    fun new_clock(scenario: &mut ts::Scenario): Clock {
        let mut c = clock::create_for_testing(ts::ctx(scenario));
        clock::set_for_testing(&mut c, 1000000); // 1000 s
        c
    }

    /// init book, add TARGET_CHAIN, and create one standard active order (id 1) by ALICE.
    fun setup_with_order(scenario: &mut ts::Scenario, clock: &Clock) {
        ts::next_tx(scenario, ALICE);
        { ccob::init_for_testing(ts::ctx(scenario)); };
        ts::next_tx(scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBook>(scenario);
            ccob::add_supported_chain(&mut book, TARGET_CHAIN);
            ccob::create_order(
                &mut book, b"TKA", 1000, b"TKB", 500,
                TARGET_CHAIN, TARGET_ADDR, 3600, 100000,
                clock, ts::ctx(scenario),
            );
            ts::return_shared(book);
        };
    }

    fun match_by(scenario: &mut ts::Scenario, who: address, clock: &Clock) {
        ts::next_tx(scenario, who);
        {
            let mut book = ts::take_shared<OrderBook>(scenario);
            ccob::match_order(&mut book, 1, HTLC_ID, clock, ts::ctx(scenario));
            ts::return_shared(book);
        };
    }

    // ===== create-time validation =====

    #[test]
    #[expected_failure(abort_code = dex::cross_chain_order_book::E_UNSUPPORTED_CHAIN)]
    fun test_create_unsupported_chain_fails() {
        let mut scenario = ts::begin(ALICE);
        let clock = new_clock(&mut scenario);
        ts::next_tx(&mut scenario, ALICE);
        { ccob::init_for_testing(ts::ctx(&mut scenario)); };
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            // 999999 was never added to supported_chains.
            ccob::create_order(
                &mut book, b"TKA", 1000, b"TKB", 500,
                999999, TARGET_ADDR, 3600, 100000,
                &clock, ts::ctx(&mut scenario),
            );
            ts::return_shared(book);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::cross_chain_order_book::E_SAME_CHAIN)]
    fun test_create_same_chain_fails() {
        let mut scenario = ts::begin(ALICE);
        let clock = new_clock(&mut scenario);
        ts::next_tx(&mut scenario, ALICE);
        { ccob::init_for_testing(ts::ctx(&mut scenario)); };
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            // chain_id is the SUI placeholder 0; targeting it is a same-chain order.
            ccob::create_order(
                &mut book, b"TKA", 1000, b"TKB", 500,
                0, TARGET_ADDR, 3600, 100000,
                &clock, ts::ctx(&mut scenario),
            );
            ts::return_shared(book);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::cross_chain_order_book::E_INVALID_TIMELOCK)]
    fun test_create_min_timelock_too_low_fails() {
        let mut scenario = ts::begin(ALICE);
        let clock = new_clock(&mut scenario);
        ts::next_tx(&mut scenario, ALICE);
        { ccob::init_for_testing(ts::ctx(&mut scenario)); };
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::add_supported_chain(&mut book, TARGET_CHAIN);
            ccob::create_order(
                &mut book, b"TKA", 1000, b"TKB", 500,
                TARGET_CHAIN, TARGET_ADDR, 3599, 100000, // min_timelock < 3600
                &clock, ts::ctx(&mut scenario),
            );
            ts::return_shared(book);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::cross_chain_order_book::E_INVALID_EXPIRY)]
    fun test_create_past_expiry_fails() {
        let mut scenario = ts::begin(ALICE);
        let clock = new_clock(&mut scenario); // current = 1000 s
        ts::next_tx(&mut scenario, ALICE);
        { ccob::init_for_testing(ts::ctx(&mut scenario)); };
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::add_supported_chain(&mut book, TARGET_CHAIN);
            ccob::create_order(
                &mut book, b"TKA", 1000, b"TKB", 500,
                TARGET_CHAIN, TARGET_ADDR, 3600, 500, // expires in the past (< 1000)
                &clock, ts::ctx(&mut scenario),
            );
            ts::return_shared(book);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::cross_chain_order_book::E_INVALID_AMOUNTS)]
    fun test_create_zero_sell_amount_fails() {
        let mut scenario = ts::begin(ALICE);
        let clock = new_clock(&mut scenario);
        ts::next_tx(&mut scenario, ALICE);
        { ccob::init_for_testing(ts::ctx(&mut scenario)); };
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::add_supported_chain(&mut book, TARGET_CHAIN);
            ccob::create_order(
                &mut book, b"TKA", 0, b"TKB", 500,
                TARGET_CHAIN, TARGET_ADDR, 3600, 100000,
                &clock, ts::ctx(&mut scenario),
            );
            ts::return_shared(book);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== status guards =====

    #[test]
    #[expected_failure(abort_code = dex::cross_chain_order_book::E_ORDER_NOT_ACTIVE)]
    fun test_match_already_matched_fails() {
        let mut scenario = ts::begin(ALICE);
        let clock = new_clock(&mut scenario);
        setup_with_order(&mut scenario, &clock);
        match_by(&mut scenario, BOB, &clock);
        match_by(&mut scenario, CAROL, &clock); // already matched
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::cross_chain_order_book::E_ORDER_NOT_ACTIVE)]
    fun test_complete_unmatched_fails() {
        let mut scenario = ts::begin(ALICE);
        let clock = new_clock(&mut scenario);
        setup_with_order(&mut scenario, &clock);
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::complete_order(&mut book, 1, ts::ctx(&mut scenario)); // still ACTIVE, not MATCHED
            ts::return_shared(book);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::cross_chain_order_book::E_NOT_ORDER_CREATOR)]
    fun test_complete_by_stranger_fails() {
        let mut scenario = ts::begin(ALICE);
        let clock = new_clock(&mut scenario);
        setup_with_order(&mut scenario, &clock);
        match_by(&mut scenario, BOB, &clock);
        ts::next_tx(&mut scenario, CAROL); // neither creator nor matcher
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::complete_order(&mut book, 1, ts::ctx(&mut scenario));
            ts::return_shared(book);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    /// The creator (not only the matcher) may complete a matched order.
    fun test_complete_by_creator_succeeds() {
        let mut scenario = ts::begin(ALICE);
        let clock = new_clock(&mut scenario);
        setup_with_order(&mut scenario, &clock);
        match_by(&mut scenario, BOB, &clock);
        ts::next_tx(&mut scenario, ALICE);
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
    #[expected_failure(abort_code = dex::cross_chain_order_book::E_NOT_ORDER_CREATOR)]
    fun test_cancel_not_creator_fails() {
        let mut scenario = ts::begin(ALICE);
        let clock = new_clock(&mut scenario);
        setup_with_order(&mut scenario, &clock);
        ts::next_tx(&mut scenario, BOB); // not the creator
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::cancel_order(&mut book, 1, ts::ctx(&mut scenario));
            ts::return_shared(book);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::cross_chain_order_book::E_ORDER_NOT_ACTIVE)]
    fun test_cancel_matched_order_fails() {
        let mut scenario = ts::begin(ALICE);
        let clock = new_clock(&mut scenario);
        setup_with_order(&mut scenario, &clock);
        match_by(&mut scenario, BOB, &clock);
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::cancel_order(&mut book, 1, ts::ctx(&mut scenario)); // matched, not active
            ts::return_shared(book);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::cross_chain_order_book::E_NOT_ORDER_CREATOR)]
    fun test_reactivate_not_creator_fails() {
        let mut scenario = ts::begin(ALICE);
        let clock = new_clock(&mut scenario);
        setup_with_order(&mut scenario, &clock);
        match_by(&mut scenario, BOB, &clock);
        ts::next_tx(&mut scenario, BOB); // matcher tries to reactivate
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            ccob::reactivate_order(&mut book, 1, &clock, ts::ctx(&mut scenario));
            ts::return_shared(book);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== access control regression marker =====

    #[test]
    /// Documents the CURRENT (insecure) behaviour: add_supported_chain has no access control, so a
    /// non-admin (BOB) can register an arbitrary chain. When access control is added (AdminCap, see
    /// docs/FUTURE_WORK.md), this should instead abort for a non-admin — update this test then.
    fun test_add_supported_chain_has_no_access_control() {
        let mut scenario = ts::begin(ALICE);
        ts::next_tx(&mut scenario, ALICE);
        { ccob::init_for_testing(ts::ctx(&mut scenario)); };
        ts::next_tx(&mut scenario, BOB); // arbitrary non-admin caller
        {
            let mut book = ts::take_shared<OrderBook>(&scenario);
            let before = ccob::get_supported_chains(&book).length();
            ccob::add_supported_chain(&mut book, 424242);
            let after = ccob::get_supported_chains(&book).length();
            assert!(after == before + 1, 0); // BOB successfully added a chain
            ts::return_shared(book);
        };
        ts::end(scenario);
    }
}
