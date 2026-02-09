// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TokenManager} from "./TokenManager.sol";

/**
 * @title OrderBook (Polygon)
 * @notice Manages the order book for the decentralized exchange
 */
contract OrderBook is ReentrancyGuard, Ownable {
    TokenManager public immutable TOKEN_MANAGER;
    bool public restrictTokens;
    address public tradeContract;

    error InvalidTokenManager();
    error InvalidAmounts();
    error SameAssetTrade();
    error TokenNotSupported();
    error IncorrectMATICAmount();
    error MATICSentWithERC20();
    error InsufficientAllowance();
    error TokenTransferFailed();
    error OrderDoesNotExist();
    error OrderNotActive();
    error NotOrderCreator();
    error MATICReturnFailed();
    error OnlyTradeContract();
    error InvalidTradeContract();
    error NoFundsToMove();
    error MATICTransferToTradeFailed();
    error RestrictionAlreadySet();

    enum OrderStatus {
        Active,
        Pending,
        Completed,
        Cancelled
    }

    struct Order {
        uint256 id;
        address creator;
        address tokenToSell;    // address(0) for MATIC
        address tokenToBuy;     // address(0) for MATIC
        uint256 sellAmount;
        uint256 buyAmount;
        OrderStatus status;
    }

    mapping(uint256 => Order) public orders;
    uint256 public orderCounter;

    event OrderCreated(
        uint256 indexed id,
        address indexed creator,
        address tokenToSell,
        address tokenToBuy,
        uint256 sellAmount,
        uint256 buyAmount,
        uint256 indexed timestamp
    );

    event OrderCancelled(uint256 indexed id, address indexed creator, uint256 indexed timestamp);
    event OrderExecuted(uint256 indexed id, uint256 indexed timestamp);
    event TradeContractUpdated(address indexed oldTradeContract, address indexed newTradeContract, uint256 indexed timestamp);
    event TokenRestrictionToggled(bool indexed restricted, uint256 indexed timestamp);

    modifier onlyTradeContract() {
        if (msg.sender != tradeContract) revert OnlyTradeContract();
        _;
    }

    constructor(address _tokenManagerAddress) Ownable(msg.sender) {
        if (_tokenManagerAddress == address(0)) revert InvalidTokenManager();
        TOKEN_MANAGER = TokenManager(_tokenManagerAddress);
        restrictTokens = false;
    }

    function createOrder(
        address _tokenToSell,
        address _tokenToBuy,
        uint256 _sellAmount,
        uint256 _buyAmount
    ) external payable nonReentrant returns (uint256) {
        if (_sellAmount == 0 || _buyAmount == 0) revert InvalidAmounts();
        if (_tokenToSell == _tokenToBuy) revert SameAssetTrade();

        if (restrictTokens) {
            if (_tokenToSell != address(0)) {
                if (!TOKEN_MANAGER.supportedTokens(_tokenToSell)) revert TokenNotSupported();
            }
            if (_tokenToBuy != address(0)) {
                if (!TOKEN_MANAGER.supportedTokens(_tokenToBuy)) revert TokenNotSupported();
            }
        }

        if (_tokenToSell == address(0)) {
            if (msg.value != _sellAmount) revert IncorrectMATICAmount();
        } else {
            if (msg.value != 0) revert MATICSentWithERC20();
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

    function cancelOrder(uint256 _orderId) external nonReentrant {
        Order storage order = orders[_orderId];
        if (_orderId == 0 || _orderId > orderCounter) revert OrderDoesNotExist();
        if (order.status != OrderStatus.Active) revert OrderNotActive();

        address creator = order.creator;
        if (creator != msg.sender) revert NotOrderCreator();

        uint256 amountToReturn = order.sellAmount;
        address tokenToSell = order.tokenToSell;

        order.sellAmount = 0;
        order.status = OrderStatus.Cancelled;

        if (tokenToSell == address(0)) {
            (bool sent, ) = payable(creator).call{value: amountToReturn}("");
            if (!sent) revert MATICReturnFailed();
        } else {
            IERC20 token = IERC20(tokenToSell);
            if (!token.transfer(creator, amountToReturn)) revert TokenTransferFailed();
        }

        emit OrderCancelled(_orderId, msg.sender, block.timestamp);
    }

    function deactivateOrder(uint256 _orderId) external onlyTradeContract {
        Order storage order = orders[_orderId];
        if (_orderId == 0 || _orderId > orderCounter) revert OrderDoesNotExist();
        if (order.status != OrderStatus.Active && order.status != OrderStatus.Pending) revert OrderNotActive();
        order.status = OrderStatus.Completed;
        emit OrderExecuted(_orderId, block.timestamp);
    }

    function setTradeContract(address _tradeContract) external onlyOwner {
        if (_tradeContract == address(0)) revert InvalidTradeContract();
        emit TradeContractUpdated(tradeContract, _tradeContract, block.timestamp);
        tradeContract = _tradeContract;
    }

    function moveTokensToTradeContract(uint256 _orderId) external onlyTradeContract {
        Order storage order = orders[_orderId];
        if (_orderId == 0 || _orderId > orderCounter) revert OrderDoesNotExist();
        if (order.status != OrderStatus.Active) revert OrderNotActive();
        if (order.sellAmount == 0) revert NoFundsToMove();

        uint256 amountToMove = order.sellAmount;
        address tokenToSell = order.tokenToSell;
        address tradeAddr = tradeContract;

        order.sellAmount = 0;
        order.status = OrderStatus.Pending;

        if (tokenToSell == address(0)) {
            (bool sent, ) = payable(tradeAddr).call{value: amountToMove}("");
            if (!sent) revert MATICTransferToTradeFailed();
        } else {
            IERC20 token = IERC20(tokenToSell);
            if (!token.transfer(tradeAddr, amountToMove)) revert TokenTransferFailed();
        }
    }

    function toggleTokenRestriction(bool _restricted) external onlyOwner {
        if (restrictTokens == _restricted) revert RestrictionAlreadySet();
        restrictTokens = _restricted;
        emit TokenRestrictionToggled(_restricted, block.timestamp);
    }

    function getOrder(uint256 _orderId) external view returns (Order memory) {
        if (_orderId == 0 || _orderId > orderCounter) revert OrderDoesNotExist();
        return orders[_orderId];
    }

    function isOrderActive(uint256 _orderId) external view returns (bool) {
        if (_orderId == 0 || _orderId > orderCounter) return false;
        return orders[_orderId].status == OrderStatus.Active;
    }

    function getMaticBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {}
}
