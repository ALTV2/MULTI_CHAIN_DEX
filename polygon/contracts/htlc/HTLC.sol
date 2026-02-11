// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HTLC - Hash Time-Locked Contract (Polygon)
 * @notice Enables trustless cross-chain atomic swaps using hashlock and timelock
 * @dev Supports both native tokens (MATIC) and ERC20 tokens
 * @notice Security: the secret is revealed on-chain during withdraw, so miners can front-run the transaction by observing the mempool
 * @dev Swap ID uniqueness is derived from (initiator, participant, hashlock, timelock, chainId); callers must ensure unique parameters per initiator+participant pair
 */
contract HTLC is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum SwapStatus {
        Empty,      // Swap does not exist
        Active,     // Swap is active and can be withdrawn
        Withdrawn,  // Swap completed - funds withdrawn with secret
        Refunded    // Swap expired - funds returned to initiator
    }

    struct Swap {
        address initiator;      // Who created the swap
        address participant;    // Who can withdraw the funds
        address token;          // Token address (address(0) for native token)
        uint256 amount;         // Amount locked
        bytes32 hashlock;       // keccak256(secret)
        uint256 timelock;       // Unix timestamp when refund becomes available
        SwapStatus status;      // Current status
    }

    // swapId => Swap
    mapping(bytes32 => Swap) public swaps;

    // Track all swap IDs for a user (as initiator)
    mapping(address => bytes32[]) public userSwapsAsInitiator;
    // Track all swap IDs for a user (as participant)
    mapping(address => bytes32[]) public userSwapsAsParticipant;

    // Events
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

    // Custom errors for gas efficiency
    error SwapAlreadyExists();
    error SwapNotActive();
    error InvalidHashlock();
    error TimelockNotExpired();
    error TimelockExpired();
    error InvalidAmount();
    error InvalidParticipant();
    error InvalidTimelock();
    error TransferFailed();

    /**
     * @notice Create a new HTLC swap
     * @param _swapId Unique identifier for the swap
     * @param _participant Address that can withdraw the funds
     * @param _hashlock Hash of the secret (keccak256)
     * @param _timelock Unix timestamp until which withdrawal is possible
     * @param _token Token address (address(0) for native token)
     * @param _amount Amount to lock (ignored for native token, uses msg.value)
     */
    function createSwap(
        bytes32 _swapId,
        address _participant,
        bytes32 _hashlock,
        uint256 _timelock,
        address _token,
        uint256 _amount
    ) external payable nonReentrant {
        if (swaps[_swapId].status != SwapStatus.Empty) revert SwapAlreadyExists();
        if (_participant == address(0)) revert InvalidParticipant();
        if (_timelock <= block.timestamp) revert InvalidTimelock();
        if (_hashlock == bytes32(0)) revert InvalidHashlock();

        uint256 finalAmount;

        if (_token == address(0)) {
            // Native token (MATIC)
            if (msg.value == 0) revert InvalidAmount();
            finalAmount = msg.value;
        } else {
            // ERC20 token
            if (_amount == 0) revert InvalidAmount();
            if (msg.value > 0) revert InvalidAmount();
            finalAmount = _amount;
            IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        }

        swaps[_swapId] = Swap({
            initiator: msg.sender,
            participant: _participant,
            token: _token,
            amount: finalAmount,
            hashlock: _hashlock,
            timelock: _timelock,
            status: SwapStatus.Active
        });

        userSwapsAsInitiator[msg.sender].push(_swapId);
        userSwapsAsParticipant[_participant].push(_swapId);

        emit SwapCreated(
            _swapId,
            msg.sender,
            _participant,
            _token,
            finalAmount,
            _hashlock,
            _timelock
        );
    }

    /**
     * @notice Withdraw funds by revealing the secret
     * @param _swapId Swap identifier
     * @param _secret The preimage of the hashlock
     */
    function withdraw(bytes32 _swapId, bytes32 _secret) external nonReentrant {
        Swap storage swap = swaps[_swapId];

        if (swap.status != SwapStatus.Active) revert SwapNotActive();
        if (block.timestamp >= swap.timelock) revert TimelockExpired();
        if (keccak256(abi.encodePacked(_secret)) != swap.hashlock) {
            revert InvalidHashlock();
        }

        swap.status = SwapStatus.Withdrawn;

        address recipient = swap.participant;
        uint256 amount = swap.amount;

        if (swap.token == address(0)) {
            (bool success, ) = payable(recipient).call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(swap.token).safeTransfer(recipient, amount);
        }

        emit SwapWithdrawn(_swapId, _secret, recipient);
    }

    /**
     * @notice Refund funds after timelock expiration
     * @param _swapId Swap identifier
     */
    function refund(bytes32 _swapId) external nonReentrant {
        Swap storage swap = swaps[_swapId];

        if (swap.status != SwapStatus.Active) revert SwapNotActive();
        if (block.timestamp < swap.timelock) revert TimelockNotExpired();

        swap.status = SwapStatus.Refunded;

        address recipient = swap.initiator;
        uint256 amount = swap.amount;

        if (swap.token == address(0)) {
            (bool success, ) = payable(recipient).call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(swap.token).safeTransfer(recipient, amount);
        }

        emit SwapRefunded(_swapId, recipient);
    }

    // ============ View Functions ============

    function getSwap(bytes32 _swapId) external view returns (Swap memory) {
        return swaps[_swapId];
    }

    function isSwapActive(bytes32 _swapId) external view returns (bool) {
        return swaps[_swapId].status == SwapStatus.Active;
    }

    function getHashlock(bytes32 _secret) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_secret));
    }

    function getSwapsAsInitiator(address _user) external view returns (bytes32[] memory) {
        return userSwapsAsInitiator[_user];
    }

    function getSwapsAsParticipant(address _user) external view returns (bytes32[] memory) {
        return userSwapsAsParticipant[_user];
    }

    function generateSwapId(
        address _initiator,
        address _participant,
        bytes32 _hashlock,
        uint256 _timelock
    ) external view returns (bytes32) {
        return keccak256(abi.encodePacked(
            _initiator,
            _participant,
            _hashlock,
            _timelock,
            block.chainid
        ));
    }
}
