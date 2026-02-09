// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IHTLC
 * @notice Interface for Hash Time-Locked Contract
 */
interface IHTLC {
    enum SwapStatus {
        Empty,
        Active,
        Withdrawn,
        Refunded
    }

    struct Swap {
        address initiator;
        address participant;
        address token;
        uint256 amount;
        bytes32 hashlock;
        uint256 timelock;
        SwapStatus status;
    }

    event SwapCreated(
        bytes32 indexed swapId,
        address indexed initiator,
        address indexed participant,
        address token,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock
    );

    event SwapWithdrawn(
        bytes32 indexed swapId,
        bytes32 secret,
        address indexed participant
    );

    event SwapRefunded(
        bytes32 indexed swapId,
        address indexed initiator
    );

    function createSwap(
        bytes32 _swapId,
        address _participant,
        bytes32 _hashlock,
        uint256 _timelock,
        address _token,
        uint256 _amount
    ) external payable;

    function withdraw(bytes32 _swapId, bytes32 _secret) external;

    function refund(bytes32 _swapId) external;

    function getSwap(bytes32 _swapId) external view returns (Swap memory);

    function isSwapActive(bytes32 _swapId) external view returns (bool);

    function getHashlock(bytes32 _secret) external pure returns (bytes32);
}
