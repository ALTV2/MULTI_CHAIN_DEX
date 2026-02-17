// SPDX-License-Identifier: MIT

/// Test Token A for DEX testing
module dex::test_token_a {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use std::option;

    /// One-time witness for coin creation
    struct TEST_TOKEN_A has drop {}

    /// Initialize the token on deployment
    /// Creates currency and transfers treasury to deployer
    fun init(witness: TEST_TOKEN_A, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            9,  // decimals (SUI standard is 9)
            b"sTKA",
            b"SUI Test Token A",
            b"Test token for Multi-Chain DEX",
            option::none(),
            ctx
        );

        // Freeze metadata so it can't be changed
        transfer::public_freeze_object(metadata);

        // Transfer treasury to deployer for minting
        transfer::public_transfer(treasury, tx_context::sender(ctx));
    }

    /// Mint new tokens
    /// Only treasury owner can call this
    public entry fun mint(
        treasury: &mut TreasuryCap<TEST_TOKEN_A>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(treasury, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }

    /// Burn tokens
    public entry fun burn(
        treasury: &mut TreasuryCap<TEST_TOKEN_A>,
        coin: Coin<TEST_TOKEN_A>
    ) {
        coin::burn(treasury, coin);
    }

    #[test_only]
    /// Initialize for testing
    public fun init_for_testing(ctx: &mut TxContext) {
        init(TEST_TOKEN_A {}, ctx);
    }
}
