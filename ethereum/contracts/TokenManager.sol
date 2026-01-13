// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TokenManager
 * @author Alexandr Tveritin
 * @notice This contract manages the list of supported tokens for the DEX
 * @dev Contract for managing the list of supported tokens.
 */
contract TokenManager is Ownable {
    /// @notice Mapping of token addresses to their supported status
    mapping(address => bool) public supportedTokens;

    // Custom errors
    error InvalidInitialOwner();
    error InvalidTokenAddress();
    error TokenAlreadySupported();
    error TokenAlreadyNotSupported();

    /// @notice Emitted when a token is added to the supported list
    /// @param token Token address
    /// @param timestamp Block timestamp
    event TokenAdded(address indexed token, uint256 indexed timestamp);

    /// @notice Emitted when a token is removed from the supported list
    /// @param token Token address
    /// @param timestamp Block timestamp
    event TokenRemoved(address indexed token, uint256 indexed timestamp);

    /**
     * @notice Initializes the TokenManager contract
     * @param initialOwner Address of the initial owner
     */
    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert InvalidInitialOwner();
    }

    /**
     * @notice Adds a token to the supported list
     * @dev Adds a token to the list of supported tokens.
     * @param _token Token address (cannot be address(0))
     */
    function addToken(address _token) external onlyOwner {
        if (_token == address(0)) revert InvalidTokenAddress();
        if (supportedTokens[_token]) revert TokenAlreadySupported();
        supportedTokens[_token] = true;
        emit TokenAdded(_token, block.timestamp);
    }

    /**
     * @notice Removes a token from the supported list
     * @dev Removes a token from the list of supported tokens.
     * @param _token Token address
     */
    function removeToken(address _token) external onlyOwner {
        if (_token == address(0)) revert InvalidTokenAddress();
        if (!supportedTokens[_token]) revert TokenAlreadyNotSupported();
        supportedTokens[_token] = false;
        emit TokenRemoved(_token, block.timestamp);
    }

    /**
     * @notice Checks if a token is supported
     * @param _token Token address to check
     * @return Whether the token is supported
     */
    function isTokenSupported(address _token) external view returns (bool) {
        return supportedTokens[_token];
    }
}