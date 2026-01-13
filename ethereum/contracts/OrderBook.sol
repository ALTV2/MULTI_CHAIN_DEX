// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TokenManager} from "./TokenManager.sol";

/**
 * @title OrderBook
 * @author Alexandr Tveritin
 * @notice This contract manages the order book for a decentralized exchange
 * @dev Contract for managing DEX order book with ERC20 and ETH support.
 * Allows creating, canceling, and executing orders with optional token restrictions.
 */
contract OrderBook is ReentrancyGuard, Ownable {
    /// @notice Token management contract
    TokenManager public immutable TOKEN_MANAGER;

    /// @notice Flag to restrict tokens to the supported list
    bool public restrictTokens;

    /// @notice Address of the Trade contract
    address public tradeContract;

    // Custom errors
    error InvalidTokenManager();
    error InvalidAmounts();
    error SameAssetTrade();
    error TokenNotSupported();
    error IncorrectETHAmount();
    error ETHSentWithERC20();
    error InsufficientAllowance();
    error TokenTransferFailed();
    error OrderDoesNotExist();
    error OrderNotActive();
    error NotOrderCreator();
    error ETHReturnFailed();
    error OnlyTradeContract();
    error InvalidTradeContract();
    error NoFundsToMove();
    error ETHTransferToTradeFailed();
    error RestrictionAlreadySet();

    enum OrderStatus {
        Active,    // Active (after creation)
        Pending,   // Pending completion
        Completed, // Successfully executed
        Cancelled  // Cancelled
    }

    struct Order {
        uint256 id;             // Unique order ID
        address creator;        // Order creator
        address tokenToSell;    // Token to sell (address(0) for ETH)
        address tokenToBuy;     // Token to buy (address(0) for ETH)
        uint256 sellAmount;     // Amount to sell
        uint256 buyAmount;      // Amount to buy
        OrderStatus status;     // Order status
    }

    /// @notice Mapping of order ID to Order struct
    mapping(uint256 => Order) public orders;

    /// @notice Counter for order IDs
    uint256 public orderCounter;

    /// @notice Emitted when a new order is created
    /// @param id Order ID
    /// @param creator Address of the order creator
    /// @param tokenToSell Token to sell (address(0) for ETH)
    /// @param tokenToBuy Token to buy (address(0) for ETH)
    /// @param sellAmount Amount to sell
    /// @param buyAmount Amount to buy
    /// @param timestamp Block timestamp
    event OrderCreated(
        uint256 indexed id,
        address indexed creator,
        address tokenToSell,
        address tokenToBuy,
        uint256 sellAmount,
        uint256 buyAmount,
        uint256 indexed timestamp
    );

    /// @notice Emitted when an order is cancelled
    /// @param id Order ID
    /// @param creator Address of the order creator
    /// @param timestamp Block timestamp
    event OrderCancelled(uint256 indexed id, address indexed creator, uint256 indexed timestamp);

    /// @notice Emitted when an order is executed
    /// @param id Order ID
    /// @param timestamp Block timestamp
    event OrderExecuted(uint256 indexed id, uint256 indexed timestamp);

    /// @notice Emitted when the Trade contract address is updated
    /// @param oldTradeContract Previous Trade contract address
    /// @param newTradeContract New Trade contract address
    /// @param timestamp Block timestamp
    event TradeContractUpdated(address indexed oldTradeContract, address indexed newTradeContract, uint256 indexed timestamp);

    /// @notice Emitted when token restriction is toggled
    /// @param restricted New restriction status
    /// @param timestamp Block timestamp
    event TokenRestrictionToggled(bool indexed restricted, uint256 indexed timestamp);

    modifier onlyTradeContract() {
        if (msg.sender != tradeContract) revert OnlyTradeContract();
        _;
    }

    /**
     * @notice Initializes the OrderBook contract
     * @param _tokenManagerAddress Address of the TokenManager contract
     */
    constructor(address _tokenManagerAddress) Ownable(msg.sender) {
        if (_tokenManagerAddress == address(0)) revert InvalidTokenManager();
        TOKEN_MANAGER = TokenManager(_tokenManagerAddress);
        restrictTokens = false;
    }


    /**
     * @notice Creates a new order in the order book
     * @dev Creates a new order with the specified parameters.
     * @param _tokenToSell Token/ETH to sell
     * @param _tokenToBuy Token/ETH to buy
     * @param _sellAmount Amount to sell
     * @param _buyAmount Amount to buy
     * @return orderId ID of the created order
     */
    function createOrder(
        address _tokenToSell,
        address _tokenToBuy,
        uint256 _sellAmount,
        uint256 _buyAmount
    ) external payable nonReentrant returns (uint256) {
        if (_sellAmount == 0 || _buyAmount == 0) revert InvalidAmounts();
        if (_tokenToSell == _tokenToBuy) revert SameAssetTrade();

        // Check token restrictions if enabled
        if (restrictTokens) {
            if (_tokenToSell != address(0)) {
                if (!TOKEN_MANAGER.supportedTokens(_tokenToSell)) revert TokenNotSupported();
            }
            if (_tokenToBuy != address(0)) {
                if (!TOKEN_MANAGER.supportedTokens(_tokenToBuy)) revert TokenNotSupported();
            }
        }

        // Handle ETH or ERC20
        if (_tokenToSell == address(0)) {
            if (msg.value != _sellAmount) revert IncorrectETHAmount();
        } else {
            if (msg.value != 0) revert ETHSentWithERC20();
            IERC20 tokenToSell = IERC20(_tokenToSell);
            if (tokenToSell.allowance(msg.sender, address(this)) < _sellAmount) {
                revert InsufficientAllowance();
            }
            if (!tokenToSell.transferFrom(msg.sender, address(this), _sellAmount)) {
                revert TokenTransferFailed();
            }
        }

        uint256 orderId = ++orderCounter;

        orders[orderId] = Order({
            id: orderId,
            creator: msg.sender,
            tokenToSell: _tokenToSell,
            tokenToBuy: _tokenToBuy,
            sellAmount: _sellAmount,
            buyAmount: _buyAmount,
            status: OrderStatus.Active
        });

        emit OrderCreated(orderId, msg.sender, _tokenToSell, _tokenToBuy, _sellAmount, _buyAmount, block.timestamp);
        return orderId;
    }

    /**
     * @notice Cancels an order and returns assets to the creator
     * @dev Cancels the order and returns assets using CEI pattern.
     * @param _orderId Order ID
     */
    function cancelOrder(uint256 _orderId) external nonReentrant {
        Order storage order = orders[_orderId];
        if (_orderId == 0 || _orderId > orderCounter) revert OrderDoesNotExist();
        if (order.status != OrderStatus.Active) revert OrderNotActive();

        address creator = order.creator; // Cache for gas savings
        if (creator != msg.sender) revert NotOrderCreator();

        uint256 amountToReturn = order.sellAmount;
        address tokenToSell = order.tokenToSell; // Cache for gas savings

        // Effects: modify state before external calls
        order.sellAmount = 0;
        order.status = OrderStatus.Cancelled;

        // Interactions: external calls at the end
        if (tokenToSell == address(0)) {
            (bool sent, ) = payable(creator).call{value: amountToReturn}("");
            if (!sent) revert ETHReturnFailed();
        } else {
            IERC20 token = IERC20(tokenToSell);
            if (!token.transfer(creator, amountToReturn)) revert TokenTransferFailed();
        }

        emit OrderCancelled(_orderId, msg.sender, block.timestamp);
    }

    /**
     * @notice Deactivates an order (only Trade contract can call)
     * @dev Deactivates the order after successful execution.
     * @param _orderId Order ID
     */
    function deactivateOrder(uint256 _orderId) external onlyTradeContract {
        Order storage order = orders[_orderId];
        if (_orderId == 0 || _orderId > orderCounter) revert OrderDoesNotExist();
        if (order.status != OrderStatus.Active && order.status != OrderStatus.Pending) revert OrderNotActive();
        order.status = OrderStatus.Completed;
        emit OrderExecuted(_orderId, block.timestamp);
    }

    /**
     * @notice Sets the Trade contract address (only owner can call)
     * @dev Sets the Trade contract address for order execution.
     * @param _tradeContract New Trade contract address
     */
    function setTradeContract(address _tradeContract) external onlyOwner {
        if (_tradeContract == address(0)) revert InvalidTradeContract();
        emit TradeContractUpdated(tradeContract, _tradeContract, block.timestamp);
        tradeContract = _tradeContract;
    }

    /**
     * @notice Moves tokens to the Trade contract (only Trade contract can call)
     * @dev Transfers order assets to Trade contract using CEI pattern.
     * @param _orderId Order ID
     */
    function moveTokensToTradeContract(uint256 _orderId) external onlyTradeContract {
        Order storage order = orders[_orderId];
        if (_orderId == 0 || _orderId > orderCounter) revert OrderDoesNotExist();
        if (order.status != OrderStatus.Active) revert OrderNotActive();
        if (order.sellAmount == 0) revert NoFundsToMove();

        uint256 amountToMove = order.sellAmount;
        address tokenToSell = order.tokenToSell; // Cache for gas savings
        address tradeAddr = tradeContract; // Cache for gas savings

        // Effects: modify state before external calls
        order.sellAmount = 0;
        order.status = OrderStatus.Pending;

        // Interactions: external calls at the end
        if (tokenToSell == address(0)) {
            (bool sent, ) = payable(tradeAddr).call{value: amountToMove}("");
            if (!sent) revert ETHTransferToTradeFailed();
        } else {
            IERC20 token = IERC20(tokenToSell);
            if (!token.transfer(tradeAddr, amountToMove)) revert TokenTransferFailed();
        }
    }

    /**
     * @notice Toggles token restriction (only owner can call)
     * @dev Enables or disables token restriction feature.
     * @param _restricted New restriction status
     */
    function toggleTokenRestriction(bool _restricted) external onlyOwner {
        if (restrictTokens == _restricted) revert RestrictionAlreadySet();
        restrictTokens = _restricted;
        emit TokenRestrictionToggled(_restricted, block.timestamp);
    }

    /**
     * @notice Gets order information by ID
     * @dev Returns the complete order information.
     * @param _orderId Order ID
     * @return Order structure with all order details
     */
    function getOrder(uint256 _orderId) external view returns (Order memory) {
        if (_orderId == 0 || _orderId > orderCounter) revert OrderDoesNotExist();
        return orders[_orderId];
    }

    /**
     * @notice Checks if an order is active
     * @dev Returns true if order exists and has Active status.
     * @param _orderId Order ID
     * @return bool True if order is active, false otherwise
     */
    function isOrderActive(uint256 _orderId) external view returns (bool) {
        if (_orderId == 0 || _orderId > orderCounter) return false;
        return orders[_orderId].status == OrderStatus.Active;
    }

    /**
     * @notice Returns the ETH balance of the contract
     * @return The ETH balance in wei
     */
    function getEthBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Allows the contract to receive ETH
     */
    receive() external payable {}
}