// SPDX-License-Identifier: MIT

/// Hash Time-Locked Contract (HTLC) for trustless cross-chain atomic swaps
/// Compatible with EVM chains via keccak256 hashing
module dex::htlc {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::event;
    use std::vector;
    use std::hash::keccak256;

    // ===== Error Codes =====

    const E_SWAP_ID_INVALID_LENGTH: u64 = 1;
    const E_HASHLOCK_INVALID_LENGTH: u64 = 2;
    const E_TIMELOCK_INVALID: u64 = 3;
    const E_AMOUNT_ZERO: u64 = 4;
    const E_NOT_PARTICIPANT: u64 = 5;
    const E_NOT_INITIATOR: u64 = 6;
    const E_NOT_ACTIVE: u64 = 7;
    const E_TIMELOCK_NOT_EXPIRED: u64 = 8;
    const E_TIMELOCK_EXPIRED: u64 = 9;
    const E_INVALID_SECRET: u64 = 10;

    // ===== Status Constants =====

    const STATUS_ACTIVE: u8 = 1;
    const STATUS_WITHDRAWN: u8 = 2;
    const STATUS_REFUNDED: u8 = 3;

    // ===== Structs =====

    /// Shared Swap object (both parties can interact)
    struct Swap<phantom T> has key {
        id: UID,
        swap_id: vector<u8>,        // 32 bytes - deterministic swap ID
        initiator: address,          // Who created the swap
        participant: address,        // Who can withdraw
        balance: Balance<T>,         // Locked funds
        hashlock: vector<u8>,       // 32 bytes - keccak256(secret)
        timelock: u64,              // Unix timestamp (seconds)
        status: u8,                 // STATUS_ACTIVE | STATUS_WITHDRAWN | STATUS_REFUNDED
    }

    // ===== Events =====

    struct SwapCreated has copy, drop {
        swap_id: vector<u8>,
        swap_object_id: address,  // Object ID for querying
        initiator: address,
        participant: address,
        amount: u64,
        hashlock: vector<u8>,
        timelock: u64,
    }

    struct SwapWithdrawn has copy, drop {
        swap_id: vector<u8>,
        swap_object_id: address,
        secret: vector<u8>,        // CRITICAL: Secret revealed here for cross-chain
        participant: address,
    }

    struct SwapRefunded has copy, drop {
        swap_id: vector<u8>,
        swap_object_id: address,
        initiator: address,
    }

    // ===== Public Functions =====

    /// Create a new HTLC swap
    ///
    /// # Arguments
    /// * `swap_id` - 32-byte deterministic swap identifier (must match EVM)
    /// * `participant` - Address that can withdraw with correct secret
    /// * `hashlock` - 32-byte keccak256 hash of the secret
    /// * `timelock` - Unix timestamp (seconds) when refund becomes available
    /// * `payment` - Coins to lock in the swap
    /// * `clock` - SUI Clock object (0x6)
    ///
    /// # Emits
    /// * `SwapCreated` event with swap details
    public entry fun create_swap<T>(
        swap_id: vector<u8>,
        participant: address,
        hashlock: vector<u8>,
        timelock: u64,
        payment: Coin<T>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // Validate inputs
        assert!(vector::length(&swap_id) == 32, E_SWAP_ID_INVALID_LENGTH);
        assert!(vector::length(&hashlock) == 32, E_HASHLOCK_INVALID_LENGTH);

        let current_time = clock::timestamp_ms(clock) / 1000; // Convert ms to seconds
        assert!(timelock > current_time, E_TIMELOCK_INVALID);

        let amount = coin::value(&payment);
        assert!(amount > 0, E_AMOUNT_ZERO);

        // Create swap object
        let swap_uid = object::new(ctx);
        let swap_object_id = object::uid_to_address(&swap_uid);

        let swap = Swap<T> {
            id: swap_uid,
            swap_id,
            initiator: tx_context::sender(ctx),
            participant,
            balance: coin::into_balance(payment),
            hashlock,
            timelock,
            status: STATUS_ACTIVE,
        };

        // Emit creation event
        event::emit(SwapCreated {
            swap_id,
            swap_object_id,
            initiator: tx_context::sender(ctx),
            participant,
            amount,
            hashlock,
            timelock,
        });

        // Share object so both parties can access
        transfer::share_object(swap);
    }

    /// Withdraw funds by revealing the secret
    /// The secret will be published in the event for cross-chain coordination
    ///
    /// # Arguments
    /// * `swap` - Shared Swap object
    /// * `secret` - 32-byte preimage of the hashlock
    /// * `clock` - SUI Clock object (0x6)
    ///
    /// # Emits
    /// * `SwapWithdrawn` event with the revealed secret
    public entry fun withdraw<T>(
        swap: &mut Swap<T>,
        secret: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // Verify caller is participant
        assert!(tx_context::sender(ctx) == swap.participant, E_NOT_PARTICIPANT);

        // Verify swap is active
        assert!(swap.status == STATUS_ACTIVE, E_NOT_ACTIVE);

        // Verify timelock not expired
        let current_time = clock::timestamp_ms(clock) / 1000;
        assert!(current_time < swap.timelock, E_TIMELOCK_EXPIRED);

        // Verify secret matches hashlock (using keccak256 for EVM compatibility)
        let computed_hashlock = keccak256(secret);
        assert!(computed_hashlock == swap.hashlock, E_INVALID_SECRET);

        // Update status
        swap.status = STATUS_WITHDRAWN;

        // Transfer funds to participant
        let amount = balance::value(&swap.balance);
        let withdrawn_balance = balance::split(&mut swap.balance, amount);
        let withdrawn_coin = coin::from_balance(withdrawn_balance, ctx);
        transfer::public_transfer(withdrawn_coin, swap.participant);

        // Emit event with revealed secret (CRITICAL for cross-chain)
        event::emit(SwapWithdrawn {
            swap_id: swap.swap_id,
            swap_object_id: object::uid_to_address(&swap.id),
            secret,  // Secret is now public on-chain
            participant: swap.participant,
        });
    }

    /// Refund funds after timelock expiration
    /// Only the initiator can call this and only after timelock expires
    ///
    /// # Arguments
    /// * `swap` - Shared Swap object
    /// * `clock` - SUI Clock object (0x6)
    ///
    /// # Emits
    /// * `SwapRefunded` event
    public entry fun refund<T>(
        swap: &mut Swap<T>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // Verify caller is initiator
        assert!(tx_context::sender(ctx) == swap.initiator, E_NOT_INITIATOR);

        // Verify swap is active
        assert!(swap.status == STATUS_ACTIVE, E_NOT_ACTIVE);

        // Verify timelock expired
        let current_time = clock::timestamp_ms(clock) / 1000;
        assert!(current_time >= swap.timelock, E_TIMELOCK_NOT_EXPIRED);

        // Update status
        swap.status = STATUS_REFUNDED;

        // Return funds to initiator
        let amount = balance::value(&swap.balance);
        let refunded_balance = balance::split(&mut swap.balance, amount);
        let refunded_coin = coin::from_balance(refunded_balance, ctx);
        transfer::public_transfer(refunded_coin, swap.initiator);

        // Emit refund event
        event::emit(SwapRefunded {
            swap_id: swap.swap_id,
            swap_object_id: object::uid_to_address(&swap.id),
            initiator: swap.initiator,
        });
    }

    // ===== View Functions =====

    /// Get swap information (read-only)
    public fun get_swap_info<T>(swap: &Swap<T>): (
        vector<u8>,  // swap_id
        address,     // initiator
        address,     // participant
        u64,         // amount
        vector<u8>,  // hashlock
        u64,         // timelock
        u8,          // status
    ) {
        (
            swap.swap_id,
            swap.initiator,
            swap.participant,
            balance::value(&swap.balance),
            swap.hashlock,
            swap.timelock,
            swap.status,
        )
    }

    /// Check if swap is active
    public fun is_swap_active<T>(swap: &Swap<T>): bool {
        swap.status == STATUS_ACTIVE
    }

    /// Get swap status
    public fun get_status<T>(swap: &Swap<T>): u8 {
        swap.status
    }

    /// Generate hashlock from secret (helper for testing)
    public fun generate_hashlock(secret: vector<u8>): vector<u8> {
        keccak256(secret)
    }

    // ===== Test-only Functions =====

    #[test_only]
    public fun get_swap_id<T>(swap: &Swap<T>): vector<u8> {
        swap.swap_id
    }

    #[test_only]
    public fun get_hashlock<T>(swap: &Swap<T>): vector<u8> {
        swap.hashlock
    }
}
