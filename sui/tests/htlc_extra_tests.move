// SPDX-License-Identifier: MIT

/// Additional HTLC coverage: input-length validation, status-transition guards (no double
/// withdraw/refund), timelock boundary conditions, and a non-SUI generic coin type.
#[test_only]
module dex::htlc_extra_tests {
    use sui::test_scenario::{Self as ts};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock;
    use std::vector;
    use dex::htlc::{Self, Swap};
    use dex::test_token_a::TEST_TOKEN_A;

    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;

    fun bytes(value: u8, len: u64): vector<u8> {
        let mut v = vector::empty<u8>();
        let mut i = 0;
        while (i < len) { vector::push_back(&mut v, value); i = i + 1; };
        v
    }

    fun b32(value: u8): vector<u8> { bytes(value, 32) }

    // ===== input validation =====

    #[test]
    #[expected_failure(abort_code = dex::htlc::E_HASHLOCK_INVALID_LENGTH)]
    /// A hashlock that is not exactly 32 bytes is rejected.
    fun test_create_invalid_hashlock_length_fails() {
        let mut scenario = ts::begin(ALICE);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);
        ts::next_tx(&mut scenario, ALICE);
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            htlc::create_swap<SUI>(b32(1), BOB, bytes(7, 31), 2000, payment, &clock, ts::ctx(&mut scenario));
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::htlc::E_SWAP_ID_INVALID_LENGTH)]
    /// A swap_id that is not exactly 32 bytes is rejected.
    fun test_create_invalid_swap_id_length_fails() {
        let mut scenario = ts::begin(ALICE);
        let hashlock = htlc::generate_hashlock(b32(42));
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);
        ts::next_tx(&mut scenario, ALICE);
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            htlc::create_swap<SUI>(bytes(1, 16), BOB, hashlock, 2000, payment, &clock, ts::ctx(&mut scenario));
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== status-transition guards =====

    #[test]
    #[expected_failure(abort_code = dex::htlc::E_NOT_ACTIVE)]
    /// A swap cannot be withdrawn twice (status leaves ACTIVE after the first withdraw).
    fun test_double_withdraw_fails() {
        let mut scenario = ts::begin(ALICE);
        let secret = b32(42);
        let hashlock = htlc::generate_hashlock(secret);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);

        ts::next_tx(&mut scenario, ALICE);
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            htlc::create_swap<SUI>(b32(1), BOB, hashlock, 2000, payment, &clock, ts::ctx(&mut scenario));
        };
        ts::next_tx(&mut scenario, BOB);
        {
            let mut swap = ts::take_shared<Swap<SUI>>(&scenario);
            htlc::withdraw<SUI>(&mut swap, secret, &clock, ts::ctx(&mut scenario));
            ts::return_shared(swap);
        };
        ts::next_tx(&mut scenario, BOB);
        {
            let mut swap = ts::take_shared<Swap<SUI>>(&scenario);
            htlc::withdraw<SUI>(&mut swap, secret, &clock, ts::ctx(&mut scenario)); // already withdrawn
            ts::return_shared(swap);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::htlc::E_NOT_ACTIVE)]
    /// After a withdraw the initiator cannot refund (funds already paid out).
    fun test_refund_after_withdraw_fails() {
        let mut scenario = ts::begin(ALICE);
        let secret = b32(42);
        let hashlock = htlc::generate_hashlock(secret);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);

        ts::next_tx(&mut scenario, ALICE);
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            htlc::create_swap<SUI>(b32(1), BOB, hashlock, 2000, payment, &clock, ts::ctx(&mut scenario));
        };
        ts::next_tx(&mut scenario, BOB);
        {
            let mut swap = ts::take_shared<Swap<SUI>>(&scenario);
            htlc::withdraw<SUI>(&mut swap, secret, &clock, ts::ctx(&mut scenario));
            ts::return_shared(swap);
        };
        // Even past the timelock, refund must fail because the swap is no longer ACTIVE.
        clock::set_for_testing(&mut clock, 3000000);
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut swap = ts::take_shared<Swap<SUI>>(&scenario);
            htlc::refund<SUI>(&mut swap, &clock, ts::ctx(&mut scenario));
            ts::return_shared(swap);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::htlc::E_NOT_ACTIVE)]
    /// After a refund the participant cannot withdraw.
    fun test_withdraw_after_refund_fails() {
        let mut scenario = ts::begin(ALICE);
        let secret = b32(42);
        let hashlock = htlc::generate_hashlock(secret);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);

        ts::next_tx(&mut scenario, ALICE);
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            htlc::create_swap<SUI>(b32(1), BOB, hashlock, 2000, payment, &clock, ts::ctx(&mut scenario));
        };
        // Past timelock, Alice refunds.
        clock::set_for_testing(&mut clock, 2100000);
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut swap = ts::take_shared<Swap<SUI>>(&scenario);
            htlc::refund<SUI>(&mut swap, &clock, ts::ctx(&mut scenario));
            ts::return_shared(swap);
        };
        // Bob tries to withdraw a refunded swap (also note: timelock expired) -> not active.
        ts::next_tx(&mut scenario, BOB);
        {
            let mut swap = ts::take_shared<Swap<SUI>>(&scenario);
            htlc::withdraw<SUI>(&mut swap, secret, &clock, ts::ctx(&mut scenario));
            ts::return_shared(swap);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== timelock boundary conditions =====

    #[test]
    #[expected_failure(abort_code = dex::htlc::E_TIMELOCK_EXPIRED)]
    /// Withdraw requires current_time < timelock; at the exact boundary it must fail.
    fun test_withdraw_at_exact_timelock_fails() {
        let mut scenario = ts::begin(ALICE);
        let secret = b32(42);
        let hashlock = htlc::generate_hashlock(secret);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);

        ts::next_tx(&mut scenario, ALICE);
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            htlc::create_swap<SUI>(b32(1), BOB, hashlock, 2000, payment, &clock, ts::ctx(&mut scenario));
        };
        // current_time == timelock (2000s) -> withdraw window already closed.
        clock::set_for_testing(&mut clock, 2000000);
        ts::next_tx(&mut scenario, BOB);
        {
            let mut swap = ts::take_shared<Swap<SUI>>(&scenario);
            htlc::withdraw<SUI>(&mut swap, secret, &clock, ts::ctx(&mut scenario));
            ts::return_shared(swap);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    /// Refund requires current_time >= timelock; at the exact boundary it must succeed.
    fun test_refund_at_exact_timelock_succeeds() {
        let mut scenario = ts::begin(ALICE);
        let hashlock = htlc::generate_hashlock(b32(42));
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);

        ts::next_tx(&mut scenario, ALICE);
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            htlc::create_swap<SUI>(b32(1), BOB, hashlock, 2000, payment, &clock, ts::ctx(&mut scenario));
        };
        clock::set_for_testing(&mut clock, 2000000); // exactly timelock
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut swap = ts::take_shared<Swap<SUI>>(&scenario);
            htlc::refund<SUI>(&mut swap, &clock, ts::ctx(&mut scenario));
            let (_, _, _, _, _, _, status) = htlc::get_swap_info(&swap);
            assert!(status == 3, 0); // REFUNDED
            ts::return_shared(swap);
        };
        ts::next_tx(&mut scenario, ALICE);
        {
            let received = ts::take_from_sender<Coin<SUI>>(&scenario);
            assert!(coin::value(&received) == 1000, 1);
            ts::return_to_sender(&scenario, received);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    /// Withdraw one second before the timelock still succeeds (lower boundary).
    fun test_withdraw_just_before_timelock_succeeds() {
        let mut scenario = ts::begin(ALICE);
        let secret = b32(42);
        let hashlock = htlc::generate_hashlock(secret);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);

        ts::next_tx(&mut scenario, ALICE);
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            htlc::create_swap<SUI>(b32(1), BOB, hashlock, 2000, payment, &clock, ts::ctx(&mut scenario));
        };
        clock::set_for_testing(&mut clock, 1999000); // 1999s < 2000s
        ts::next_tx(&mut scenario, BOB);
        {
            let mut swap = ts::take_shared<Swap<SUI>>(&scenario);
            htlc::withdraw<SUI>(&mut swap, secret, &clock, ts::ctx(&mut scenario));
            let (_, _, _, _, _, _, status) = htlc::get_swap_info(&swap);
            assert!(status == 2, 0); // WITHDRAWN
            ts::return_shared(swap);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== generic (non-SUI) coin type =====

    #[test]
    /// The HTLC is generic over the coin type; a full create→withdraw works for TEST_TOKEN_A and
    /// the participant receives exactly the locked amount (per-object Balance<T>, no shared pool).
    fun test_generic_token_swap_withdraw() {
        let mut scenario = ts::begin(ALICE);
        let secret = b32(42);
        let hashlock = htlc::generate_hashlock(secret);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);

        ts::next_tx(&mut scenario, ALICE);
        {
            let payment = coin::mint_for_testing<TEST_TOKEN_A>(777, ts::ctx(&mut scenario));
            htlc::create_swap<TEST_TOKEN_A>(b32(1), BOB, hashlock, 2000, payment, &clock, ts::ctx(&mut scenario));
        };
        ts::next_tx(&mut scenario, BOB);
        {
            let mut swap = ts::take_shared<Swap<TEST_TOKEN_A>>(&scenario);
            htlc::withdraw<TEST_TOKEN_A>(&mut swap, secret, &clock, ts::ctx(&mut scenario));
            ts::return_shared(swap);
        };
        ts::next_tx(&mut scenario, BOB);
        {
            let received = ts::take_from_sender<Coin<TEST_TOKEN_A>>(&scenario);
            assert!(coin::value(&received) == 777, 0);
            ts::return_to_sender(&scenario, received);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
