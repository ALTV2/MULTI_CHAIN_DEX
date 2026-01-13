// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OrderBook} from "./OrderBook.sol";

/**
 * @title Trade
 * @author Alexandr Tveritin
 * @notice This contract executes orders from the OrderBook
 * @dev Contract for executing orders from OrderBook with ERC20 and ETH support.
 */
contract Trade is ReentrancyGuard {
    /// @notice OrderBook contract reference
    OrderBook public immutable ORDER_BOOK;

    // Custom errors
    error InvalidOrderBookAddress();
    error OrderDoesNotExist();
    error OrderNotActive();
    error CannotExecuteOwnOrder();
    error IncorrectETHAmount();
    error ETHSentWithERC20();
    error InsufficientAllowance();
    error ETHTransferToCreatorFailed();
    error TokenBuyTransferFailed();
    error ETHTransferToExecutorFailed();
    error TokenSellTransferFailed();

    /// @notice Emitted when an order is successfully executed
    /// @param orderId Order ID
    /// @param executor Address of the order executor
    /// @param creator Address of the order creator
    /// @param sellAmount Amount sold
    /// @param buyAmount Amount bought
    /// @param timestamp Block timestamp
    event OrderExecuted(
        uint256 indexed orderId,
        address indexed executor,
        address indexed creator,
        uint256 sellAmount,
        uint256 buyAmount,
        uint256 timestamp
    );

    /**
     * @notice Initializes the Trade contract
     * @param _orderBookAddress Address of the OrderBook contract
     */
    constructor(address payable _orderBookAddress) {
        if (_orderBookAddress == address(0)) revert InvalidOrderBookAddress();
        ORDER_BOOK = OrderBook(_orderBookAddress);
    }

    /**
     * @notice Executes an order from the OrderBook
     * @dev Executes the order by swapping assets between creator and executor.
     * @param _orderId Order ID
     */
    function executeOrder(uint256 _orderId) external payable nonReentrant {
        // Get order data from OrderBook
        (
            uint256 id,
            address creator,
            address tokenToSellAddr,
            address tokenToBuyAddr,
            uint256 sellAmount,
            uint256 buyAmount,
            OrderBook.OrderStatus status
        ) = ORDER_BOOK.orders(_orderId);

        if (id != _orderId || id > ORDER_BOOK.orderCounter()) revert OrderDoesNotExist();
        if (status != OrderBook.OrderStatus.Active) revert OrderNotActive();
        if (creator == msg.sender) revert CannotExecuteOwnOrder();

        // Handle token/ETH payment to order creator
        if (tokenToBuyAddr == address(0)) {
            if (msg.value != buyAmount) revert IncorrectETHAmount();
            (bool sentToCreator, ) = payable(creator).call{value: buyAmount}("");
            if (!sentToCreator) revert ETHTransferToCreatorFailed();
        } else {
            if (msg.value != 0) revert ETHSentWithERC20();
            IERC20 tokenToBuy = IERC20(tokenToBuyAddr);
            if (tokenToBuy.allowance(msg.sender, address(this)) < buyAmount) {
                revert InsufficientAllowance();
            }
            if (!tokenToBuy.transferFrom(msg.sender, creator, buyAmount)) {
                revert TokenBuyTransferFailed();
            }
        }

        // Move assets from OrderBook
        ORDER_BOOK.moveTokensToTradeContract(_orderId);

        // Transfer assets to executor
        if (tokenToSellAddr == address(0)) {
            (bool sent, ) = payable(msg.sender).call{value: sellAmount}("");
            if (!sent) revert ETHTransferToExecutorFailed();
        } else {
            IERC20 tokenToSell = IERC20(tokenToSellAddr);
            if (!tokenToSell.transfer(msg.sender, sellAmount)) revert TokenSellTransferFailed();
        }

        ORDER_BOOK.deactivateOrder(_orderId);
        emit OrderExecuted(_orderId, msg.sender, creator, sellAmount, buyAmount, block.timestamp);
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