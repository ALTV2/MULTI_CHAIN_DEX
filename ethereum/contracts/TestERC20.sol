// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestERC20
 * @author Alexandr Tveritin
 * @notice Test ERC20 token with minting capability for DEX testing
 * @dev Test ERC20 token with minting functionality for DEX testing.
 */
contract TestERC20 is ERC20, Ownable {
    // Custom error
    error InvalidRecipient();

    /**
     * @notice Initializes the test ERC20 token
     * @param name Token name
     * @param symbol Token symbol
     */
    constructor(string memory name, string memory symbol) ERC20(name, symbol) Ownable(msg.sender) {}

    /**
     * @notice Mints new tokens to a specified address
     * @param to Recipient address
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert InvalidRecipient();
        _mint(to, amount);
    }
}