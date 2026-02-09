// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TokenManager (Polygon)
 * @notice Manages the list of supported tokens for the DEX
 */
contract TokenManager is Ownable {
    mapping(address => bool) public supportedTokens;

    error InvalidInitialOwner();
    error InvalidTokenAddress();
    error TokenAlreadySupported();
    error TokenAlreadyNotSupported();

    event TokenAdded(address indexed token, uint256 indexed timestamp);
    event TokenRemoved(address indexed token, uint256 indexed timestamp);

    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert InvalidInitialOwner();
    }

    function addToken(address _token) external onlyOwner {
        if (_token == address(0)) revert InvalidTokenAddress();
        if (supportedTokens[_token]) revert TokenAlreadySupported();
        supportedTokens[_token] = true;
        emit TokenAdded(_token, block.timestamp);
    }

    function removeToken(address _token) external onlyOwner {
        if (_token == address(0)) revert InvalidTokenAddress();
        if (!supportedTokens[_token]) revert TokenAlreadyNotSupported();
        supportedTokens[_token] = false;
        emit TokenRemoved(_token, block.timestamp);
    }

    function isTokenSupported(address _token) external view returns (bool) {
        return supportedTokens[_token];
    }
}
