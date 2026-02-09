// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OrderBook} from "./OrderBook.sol";

/**
 * @title Trade (Polygon)
 * @notice Executes orders from the OrderBook
 */
contract Trade is ReentrancyGuard {
    OrderBook public immutable ORDER_BOOK;

    error InvalidOrderBookAddress();
    error OrderDoesNotExist();
    error OrderNotActive();
    error CannotExecuteOwnOrder();
    error IncorrectMATICAmount();
    error MATICSentWithERC20();
    error InsufficientAllowance();
    error MATICTransferToCreatorFailed();
    error TokenBuyTransferFailed();
    error MATICTransferToExecutorFailed();
    error TokenSellTransferFailed();

    event OrderExecuted(
        uint256 indexed orderId,
        address indexed executor,
        address indexed creator,
        uint256 sellAmount,
        uint256 buyAmount,
        uint256 timestamp
    );

    constructor(address payable _orderBookAddress) {
        if (_orderBookAddress == address(0)) revert InvalidOrderBookAddress();
        ORDER_BOOK = OrderBook(_orderBookAddress);
    }

    function executeOrder(uint256 _orderId) external payable nonReentrant {
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

        if (tokenToBuyAddr == address(0)) {
            if (msg.value != buyAmount) revert IncorrectMATICAmount();
            (bool sentToCreator, ) = payable(creator).call{value: buyAmount}("");
            if (!sentToCreator) revert MATICTransferToCreatorFailed();
        } else {
            if (msg.value != 0) revert MATICSentWithERC20();
            IERC20 tokenToBuy = IERC20(tokenToBuyAddr);
            if (tokenToBuy.allowance(msg.sender, address(this)) < buyAmount) {
                revert InsufficientAllowance();
            }
            if (!tokenToBuy.transferFrom(msg.sender, creator, buyAmount)) {
                revert TokenBuyTransferFailed();
            }
        }

        ORDER_BOOK.moveTokensToTradeContract(_orderId);

        if (tokenToSellAddr == address(0)) {
            (bool sent, ) = payable(msg.sender).call{value: sellAmount}("");
            if (!sent) revert MATICTransferToExecutorFailed();
        } else {
            IERC20 tokenToSell = IERC20(tokenToSellAddr);
            if (!tokenToSell.transfer(msg.sender, sellAmount)) revert TokenSellTransferFailed();
        }

        ORDER_BOOK.deactivateOrder(_orderId);
        emit OrderExecuted(_orderId, msg.sender, creator, sellAmount, buyAmount, block.timestamp);
    }

    function getMaticBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {}
}
