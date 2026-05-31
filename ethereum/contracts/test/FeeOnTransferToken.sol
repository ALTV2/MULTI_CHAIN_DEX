// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title FeeOnTransferToken
 * @notice TEST-ONLY token that charges a 10% fee on every transfer, so the
 *         recipient receives less than the sender sent. Used to exercise the
 *         HTLC fee-on-transfer / shared-pool accounting bug (V-3).
 */
contract FeeOnTransferToken is ERC20 {
    address public constant FEE_SINK = address(0x000000000000000000000000000000000000dEaD);
    uint256 public constant FEE_BPS = 1000; // 10%

    constructor() ERC20("Fee Token", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    // OZ v5: route all balance changes through _update.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = (value * FEE_BPS) / 10_000;
            super._update(from, to, value - fee);
            super._update(from, FEE_SINK, fee);
        } else {
            super._update(from, to, value);
        }
    }
}
