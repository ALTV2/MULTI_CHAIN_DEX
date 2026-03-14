// SPDX-License-Identifier: MIT

/// Test Token B for DEX testing
module dex::test_token_b {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use std::option;

    /// One-time witness for coin creation
    public struct TEST_TOKEN_B has drop {}

    /// Initialize the token on deployment
    /// Creates currency and transfers treasury to deployer
    fun init(witness: TEST_TOKEN_B, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            9,  // decimals (SUI standard is 9)
            b"sTKB",
            b"SUI Test Token B",
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
        treasury: &mut TreasuryCap<TEST_TOKEN_B>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(treasury, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }

    /// Burn tokens
    public entry fun burn(
        treasury: &mut TreasuryCap<TEST_TOKEN_B>,
        coin: Coin<TEST_TOKEN_B>
    ) {
        coin::burn(treasury, coin);
    }

    #[test_only]
    /// Initialize for testing
    public fun init_for_testing(ctx: &mut TxContext) {
        init(TEST_TOKEN_B {}, ctx);
    }
}
