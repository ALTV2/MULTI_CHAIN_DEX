// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CrossChainOrderBook
 * @notice On-chain order book for cross-chain swap intentions
 * @dev Stores swap intentions that can be discovered by counterparties on other chains
 * @notice Warning: the orderIds array grows indefinitely and is never pruned; this is a testnet-only design not suitable for production
 * @dev No on-chain verification of cross-chain state; order completion relies on off-chain coordination and trust in the HTLC flow
 */
contract CrossChainOrderBook is Ownable, ReentrancyGuard {

    enum OrderStatus {
        Active,     // Order is open for matching
        Matched,    // Order has been matched, HTLC in progress
        Completed,  // Swap completed successfully
        Cancelled,  // Order cancelled by creator
        Expired     // Order expired
    }

    struct CrossChainOrder {
        uint256 id;
        address creator;

        // What we're selling (on this chain)
        address sellToken;      // address(0) for native token
        uint256 sellAmount;
        uint256 sourceChainId;

        // What we want to receive (on target chain)
        address buyToken;       // Token address on target chain
        uint256 buyAmount;
        uint256 targetChainId;

        // Additional info
        address targetAddress;  // Where to receive on target chain
        uint256 minTimelock;    // Minimum acceptable timelock (seconds)
        uint256 expiresAt;      // Order expiration timestamp
        OrderStatus status;

        // Matching info
        address matchedBy;      // Address that matched this order
        bytes32 htlcSwapId;     // HTLC swap ID once created
    }

    // State
    uint256 public nextOrderId = 1;
    mapping(uint256 => CrossChainOrder) public orders;

    // Indexes for efficient queries
    uint256[] public allOrderIds;
    mapping(address => uint256[]) public ordersByCreator;
    mapping(uint256 => uint256[]) public ordersByTargetChain;
    mapping(uint256 => uint256[]) public ordersBySourceChain;

    // Supported chains configuration
    mapping(uint256 => bool) public supportedChains;
    uint256[] public supportedChainIds;

    // Events
    event OrderCreated(
        uint256 indexed orderId,
        address indexed creator,
        uint256 sourceChainId,
        uint256 targetChainId,
        address sellToken,
        uint256 sellAmount,
        address buyToken,
        uint256 buyAmount
    );

    event OrderMatched(
        uint256 indexed orderId,
        address indexed matcher,
        bytes32 htlcSwapId
    );

    event OrderCompleted(uint256 indexed orderId);
    event OrderCancelled(uint256 indexed orderId);
    event OrderExpired(uint256 indexed orderId);
    event ChainAdded(uint256 chainId);
    event ChainRemoved(uint256 chainId);

    // Errors
    error InvalidExpiry();
    error InvalidAmounts();
    error SameChainNotAllowed();
    error UnsupportedChain();
    error OrderNotActive();
    error NotOrderCreator();
    error OrderAlreadyMatched();
    error InvalidTimelock();

    constructor() Ownable(msg.sender) {
        // Add current chain as supported
        supportedChains[block.chainid] = true;
        supportedChainIds.push(block.chainid);
    }

    // ============ Admin Functions ============

    /**
     * @notice Add a supported chain
     * @param _chainId Chain ID to add
     */
    function addSupportedChain(uint256 _chainId) external onlyOwner {
        if (!supportedChains[_chainId]) {
            supportedChains[_chainId] = true;
            supportedChainIds.push(_chainId);
            emit ChainAdded(_chainId);
        }
    }

    /**
     * @notice Remove a supported chain
     * @param _chainId Chain ID to remove
     */
    function removeSupportedChain(uint256 _chainId) external onlyOwner {
        if (supportedChains[_chainId]) {
            supportedChains[_chainId] = false;
            // Note: Not removing from array to save gas, just marking as unsupported
            emit ChainRemoved(_chainId);
        }
    }

    // ============ Order Management ============

    /**
     * @notice Create a cross-chain order
     * @param _sellToken Token to sell (address(0) for native)
     * @param _sellAmount Amount to sell
     * @param _buyToken Token to buy on target chain
     * @param _buyAmount Amount to buy
     * @param _targetChainId Target chain ID
     * @param _targetAddress Address to receive on target chain
     * @param _minTimelock Minimum acceptable timelock in seconds
     * @param _expiresAt Order expiration timestamp
     */
    function createOrder(
        address _sellToken,
        uint256 _sellAmount,
        address _buyToken,
        uint256 _buyAmount,
        uint256 _targetChainId,
        address _targetAddress,
        uint256 _minTimelock,
        uint256 _expiresAt
    ) external nonReentrant returns (uint256 orderId) {
        if (_expiresAt <= block.timestamp) revert InvalidExpiry();
        if (_sellAmount == 0 || _buyAmount == 0) revert InvalidAmounts();
        if (_targetChainId == block.chainid) revert SameChainNotAllowed();
        if (!supportedChains[_targetChainId]) revert UnsupportedChain();
        if (_minTimelock < 1 hours) revert InvalidTimelock();

        orderId = nextOrderId++;

        orders[orderId] = CrossChainOrder({
            id: orderId,
            creator: msg.sender,
            sellToken: _sellToken,
            sellAmount: _sellAmount,
            sourceChainId: block.chainid,
            buyToken: _buyToken,
            buyAmount: _buyAmount,
            targetChainId: _targetChainId,
            targetAddress: _targetAddress,
            minTimelock: _minTimelock,
            expiresAt: _expiresAt,
            status: OrderStatus.Active,
            matchedBy: address(0),
            htlcSwapId: bytes32(0)
        });

        allOrderIds.push(orderId);
        ordersByCreator[msg.sender].push(orderId);
        ordersByTargetChain[_targetChainId].push(orderId);
        ordersBySourceChain[block.chainid].push(orderId);

        emit OrderCreated(
            orderId,
            msg.sender,
            block.chainid,
            _targetChainId,
            _sellToken,
            _sellAmount,
            _buyToken,
            _buyAmount
        );
    }

    /**
     * @notice Match an order (indicate intention to complete the swap)
     * @param _orderId Order ID to match
     * @param _htlcSwapId HTLC swap ID that will be used
     */
    function matchOrder(uint256 _orderId, bytes32 _htlcSwapId) external nonReentrant {
        CrossChainOrder storage order = orders[_orderId];

        if (order.status != OrderStatus.Active) revert OrderNotActive();
        if (block.timestamp >= order.expiresAt) {
            order.status = OrderStatus.Expired;
            emit OrderExpired(_orderId);
            revert OrderNotActive();
        }

        order.status = OrderStatus.Matched;
        order.matchedBy = msg.sender;
        order.htlcSwapId = _htlcSwapId;

        emit OrderMatched(_orderId, msg.sender, _htlcSwapId);
    }

    /**
     * @notice Mark order as completed
     * @param _orderId Order ID
     */
    function completeOrder(uint256 _orderId) external {
        CrossChainOrder storage order = orders[_orderId];

        if (order.status != OrderStatus.Matched) revert OrderNotActive();
        if (msg.sender != order.creator && msg.sender != order.matchedBy) {
            revert NotOrderCreator();
        }

        order.status = OrderStatus.Completed;
        emit OrderCompleted(_orderId);
    }

    /**
     * @notice Cancel an active order
     * @param _orderId Order ID to cancel
     */
    function cancelOrder(uint256 _orderId) external {
        CrossChainOrder storage order = orders[_orderId];

        if (order.status != OrderStatus.Active) revert OrderNotActive();
        if (msg.sender != order.creator) revert NotOrderCreator();

        order.status = OrderStatus.Cancelled;
        emit OrderCancelled(_orderId);
    }

    /**
     * @notice Reactivate a matched order (if HTLC failed/expired)
     * @param _orderId Order ID
     */
    function reactivateOrder(uint256 _orderId) external {
        CrossChainOrder storage order = orders[_orderId];

        if (order.status != OrderStatus.Matched) revert OrderNotActive();
        if (msg.sender != order.creator) revert NotOrderCreator();
        if (block.timestamp >= order.expiresAt) {
            order.status = OrderStatus.Expired;
            emit OrderExpired(_orderId);
            revert InvalidExpiry();
        }

        order.status = OrderStatus.Active;
        order.matchedBy = address(0);
        order.htlcSwapId = bytes32(0);
    }

    // ============ View Functions ============

    /**
     * @notice Get order details
     */
    function getOrder(uint256 _orderId) external view returns (CrossChainOrder memory) {
        return orders[_orderId];
    }

    /**
     * @notice Get all active orders for a target chain
     * @param _targetChainId Target chain ID
     */
    function getActiveOrdersForTargetChain(uint256 _targetChainId)
        external view returns (CrossChainOrder[] memory)
    {
        uint256[] memory ids = ordersByTargetChain[_targetChainId];
        uint256 activeCount = 0;

        // Count active orders
        for (uint256 i = 0; i < ids.length; i++) {
            CrossChainOrder memory order = orders[ids[i]];
            if (order.status == OrderStatus.Active && order.expiresAt > block.timestamp) {
                activeCount++;
            }
        }

        // Build result array
        CrossChainOrder[] memory result = new CrossChainOrder[](activeCount);
        uint256 j = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            CrossChainOrder memory order = orders[ids[i]];
            if (order.status == OrderStatus.Active && order.expiresAt > block.timestamp) {
                result[j++] = order;
            }
        }

        return result;
    }

    /**
     * @notice Get all orders by creator
     */
    function getOrdersByCreator(address _creator)
        external view returns (CrossChainOrder[] memory)
    {
        uint256[] memory ids = ordersByCreator[_creator];
        CrossChainOrder[] memory result = new CrossChainOrder[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = orders[ids[i]];
        }

        return result;
    }

    /**
     * @notice Get all supported chain IDs
     */
    function getSupportedChains() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < supportedChainIds.length; i++) {
            if (supportedChains[supportedChainIds[i]]) {
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < supportedChainIds.length; i++) {
            if (supportedChains[supportedChainIds[i]]) {
                result[j++] = supportedChainIds[i];
            }
        }

        return result;
    }

    /**
     * @notice Get total order count
     */
    function getTotalOrders() external view returns (uint256) {
        return nextOrderId - 1;
    }

    /**
     * @notice Get current chain ID
     */
    function getChainId() external view returns (uint256) {
        return block.chainid;
    }
}
