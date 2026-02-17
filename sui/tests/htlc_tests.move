// SPDX-License-Identifier: MIT

#[test_only]
module dex::htlc_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::test_utils;
    use std::vector;
    use dex::htlc::{Self, Swap};

    // Test addresses
    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;

    // Helper to create 32-byte vector
    fun create_32_bytes(value: u8): vector<u8> {
        let mut v = vector::empty<u8>();
        let mut i = 0;
        while (i < 32) {
            vector::push_back(&mut v, value);
            i = i + 1;
        };
        v
    }

    #[test]
    /// Test creating a swap with native SUI
    fun test_create_swap() {
        let mut scenario = ts::begin(ALICE);
        let secret = create_32_bytes(42);
        let hashlock = htlc::generate_hashlock(secret);
        let swap_id = create_32_bytes(1);

        // Create clock
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000); // 1000 seconds

        ts::next_tx(&mut scenario, ALICE);
        {
            let payment = coin::mint_for_testing<SUI>(1000000, ts::ctx(&mut scenario));

            htlc::create_swap<SUI>(
                swap_id,
                BOB,
                hashlock,
                2000, // timelock at 2000 seconds
                payment,
                &clock,
                ts::ctx(&mut scenario),
            );
        };

        // Verify swap was created
        ts::next_tx(&mut scenario, ALICE);
        {
            let swap = ts::take_shared<Swap<SUI>>(&scenario);
            let (_, initiator, participant, amount, _, timelock, status) = htlc::get_swap_info(&swap);

            assert!(initiator == ALICE, 0);
            assert!(participant == BOB, 1);
            assert!(amount == 1000000, 2);
            assert!(timelock == 2000, 3);
            assert!(status == 1, 4); // STATUS_ACTIVE

            ts::return_shared(swap);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    /// Test withdrawing with correct secret
    fun test_withdraw_with_secret() {
        let mut scenario = ts::begin(ALICE);
        let secret = create_32_bytes(42);
        let hashlock = htlc::generate_hashlock(secret);
        let swap_id = create_32_bytes(1);

        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);

        // Alice creates swap
        ts::next_tx(&mut scenario, ALICE);
        {
            let payment = coin::mint_for_testing<SUI>(1000000, ts::ctx(&mut scenario));
            htlc::create_swap<SUI>(
                swap_id,
                BOB,
                hashlock,
                2000,
                payment,
                &clock,
                ts::ctx(&mut scenario),
            );
        };

        // Bob withdraws with secret
        ts::next_tx(&mut scenario, BOB);
        {
            let mut swap = ts::take_shared<Swap<SUI>>(&scenario);

            htlc::withdraw<SUI>(
                &mut swap,
                secret,
                &clock,
                ts::ctx(&mut scenario),
            );

            // Verify status changed
            let (_, _, _, _, _, _, status) = htlc::get_swap_info(&swap);
            assert!(status == 2, 0); // STATUS_WITHDRAWN

            ts::return_shared(swap);
        };

        // Bob should receive the coins
        ts::next_tx(&mut scenario, BOB);
        {
            let received = ts::take_from_sender<Coin<SUI>>(&scenario);
            assert!(coin::value(&received) == 1000000, 0);
            ts::return_to_sender(&scenario, received);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::htlc::E_INVALID_SECRET)]
    /// Test withdraw with wrong secret fails
    fun test_withdraw_wrong_secret_fails() {
        let mut scenario = ts::begin(ALICE);
        let secret = create_32_bytes(42);
        let wrong_secret = create_32_bytes(99);
        let hashlock = htlc::generate_hashlock(secret);
        let swap_id = create_32_bytes(1);

        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);

        // Alice creates swap
        ts::next_tx(&mut scenario, ALICE);
        {
            let payment = coin::mint_for_testing<SUI>(1000000, ts::ctx(&mut scenario));
            htlc::create_swap<SUI>(
                swap_id,
                BOB,
                hashlock,
                2000,
                payment,
                &clock,
                ts::ctx(&mut scenario),
            );
        };

        // Bob tries to withdraw with wrong secret (should fail)
        ts::next_tx(&mut scenario, BOB);
        {
            let mut swap = ts::take_shared<Swap<SUI>>(&scenario);

            htlc::withdraw<SUI>(
                &mut swap,
                wrong_secret, // Wrong!
                &clock,
                ts::ctx(&mut scenario),
            );

            ts::return_shared(swap);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    /// Test refund after timelock
    fun test_refund_after_timelock() {
        let mut scenario = ts::begin(ALICE);
        let secret = create_32_bytes(42);
        let hashlock = htlc::generate_hashlock(secret);
        let swap_id = create_32_bytes(1);

        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);

        // Alice creates swap
        ts::next_tx(&mut scenario, ALICE);
        {
            let payment = coin::mint_for_testing<SUI>(1000000, ts::ctx(&mut scenario));
            htlc::create_swap<SUI>(
                swap_id,
                BOB,
                hashlock,
                2000, // Expires at 2000 seconds
                payment,
                &clock,
                ts::ctx(&mut scenario),
            );
        };

        // Advance time past timelock
        clock::set_for_testing(&mut clock, 2100000); // 2100 seconds

        // Alice refunds
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut swap = ts::take_shared<Swap<SUI>>(&scenario);

            htlc::refund<SUI>(
                &mut swap,
                &clock,
                ts::ctx(&mut scenario),
            );

            // Verify status changed
            let (_, _, _, _, _, _, status) = htlc::get_swap_info(&swap);
            assert!(status == 3, 0); // STATUS_REFUNDED

            ts::return_shared(swap);
        };

        // Alice should receive refund
        ts::next_tx(&mut scenario, ALICE);
        {
            let received = ts::take_from_sender<Coin<SUI>>(&scenario);
            assert!(coin::value(&received) == 1000000, 0);
            ts::return_to_sender(&scenario, received);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::htlc::E_TIMELOCK_NOT_EXPIRED)]
    /// Test refund before timelock fails
    fun test_refund_before_timelock_fails() {
        let mut scenario = ts::begin(ALICE);
        let secret = create_32_bytes(42);
        let hashlock = htlc::generate_hashlock(secret);
        let swap_id = create_32_bytes(1);

        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);

        // Alice creates swap
        ts::next_tx(&mut scenario, ALICE);
        {
            let payment = coin::mint_for_testing<SUI>(1000000, ts::ctx(&mut scenario));
            htlc::create_swap<SUI>(
                swap_id,
                BOB,
                hashlock,
                2000,
                payment,
                &clock,
                ts::ctx(&mut scenario),
            );
        };

        // Try to refund before timelock (should fail)
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut swap = ts::take_shared<Swap<SUI>>(&scenario);

            htlc::refund<SUI>(
                &mut swap,
                &clock,
                ts::ctx(&mut scenario),
            );

            ts::return_shared(swap);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = dex::htlc::E_TIMELOCK_EXPIRED)]
    /// Test withdraw after timelock fails
    fun test_withdraw_after_timelock_fails() {
        let mut scenario = ts::begin(ALICE);
        let secret = create_32_bytes(42);
        let hashlock = htlc::generate_hashlock(secret);
        let swap_id = create_32_bytes(1);

        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000000);

        // Alice creates swap
        ts::next_tx(&mut scenario, ALICE);
        {
            let payment = coin::mint_for_testing<SUI>(1000000, ts::ctx(&mut scenario));
            htlc::create_swap<SUI>(
                swap_id,
                BOB,
                hashlock,
                2000,
                payment,
                &clock,
                ts::ctx(&mut scenario),
            );
        };

        // Advance time past timelock
        clock::set_for_testing(&mut clock, 2100000);

        // Bob tries to withdraw (should fail)
        ts::next_tx(&mut scenario, BOB);
        {
            let mut swap = ts::take_shared<Swap<SUI>>(&scenario);

            htlc::withdraw<SUI>(
                &mut swap,
                secret,
                &clock,
                ts::ctx(&mut scenario),
            );

            ts::return_shared(swap);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
