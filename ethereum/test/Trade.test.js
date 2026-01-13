const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Trade", function () {
  let orderBook;
  let tokenManager;
  let trade;
  let testTokenA;
  let testTokenB;
  let owner;
  let trader1;
  let trader2;

  const INITIAL_SUPPLY = ethers.parseEther("10000");
  const ORDER_AMOUNT = ethers.parseEther("100");
  const ETH_AMOUNT = ethers.parseEther("1");

  beforeEach(async function () {
    [owner, trader1, trader2] = await ethers.getSigners();

    // Deploy TokenManager
    const TokenManager = await ethers.getContractFactory("TokenManager");
    tokenManager = await TokenManager.deploy(owner.address);
    await tokenManager.waitForDeployment();

    // Deploy OrderBook
    const OrderBook = await ethers.getContractFactory("OrderBook");
    orderBook = await OrderBook.deploy(tokenManager.target);
    await orderBook.waitForDeployment();

    // Deploy Trade
    const Trade = await ethers.getContractFactory("Trade");
    trade = await Trade.deploy(orderBook.target);
    await trade.waitForDeployment();

    // Set Trade contract in OrderBook
    await orderBook.setTradeContract(trade.target);

    // Deploy test tokens
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    testTokenA = await TestERC20.deploy("Token A", "TKA");
    await testTokenA.waitForDeployment();

    testTokenB = await TestERC20.deploy("Token B", "TKB");
    await testTokenB.waitForDeployment();

    // Mint tokens to traders
    await testTokenA.mint(trader1.address, INITIAL_SUPPLY);
    await testTokenB.mint(trader2.address, INITIAL_SUPPLY);

    // Approve OrderBook to spend tokens
    await testTokenA.connect(trader1).approve(orderBook.target, INITIAL_SUPPLY);
    await testTokenB.connect(trader2).approve(orderBook.target, INITIAL_SUPPLY);
  });

  describe("Deployment", function () {
    it("Should set the right OrderBook address", async function () {
      expect(await trade.ORDER_BOOK()).to.equal(orderBook.target);
    });

    it("Should revert if initialized with zero address", async function () {
      const Trade = await ethers.getContractFactory("Trade");
      await expect(
        Trade.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(trade, "InvalidOrderBookAddress");
    });
  });

  describe("Execute Order - ERC20 to ERC20", function () {
    beforeEach(async function () {
      // Create order: trader1 sells TKA, buys TKB
      await orderBook.connect(trader1).createOrder(
        testTokenA.target,
        testTokenB.target,
        ORDER_AMOUNT,
        ORDER_AMOUNT
      );
    });

    it("Should execute an ERC20 to ERC20 order successfully", async function () {
      // Approve Trade to spend trader2's tokens
      await testTokenB.connect(trader2).approve(trade.target, ORDER_AMOUNT);

      const trader1BalanceABefore = await testTokenA.balanceOf(trader1.address);
      const trader1BalanceBBefore = await testTokenB.balanceOf(trader1.address);
      const trader2BalanceABefore = await testTokenA.balanceOf(trader2.address);
      const trader2BalanceBBefore = await testTokenB.balanceOf(trader2.address);

      const tx = await trade.connect(trader2).executeOrder(1);

      await expect(tx)
        .to.emit(trade, "OrderExecuted");

      // Check balances
      const trader1BalanceAAfter = await testTokenA.balanceOf(trader1.address);
      const trader1BalanceBAfter = await testTokenB.balanceOf(trader1.address);
      const trader2BalanceAAfter = await testTokenA.balanceOf(trader2.address);
      const trader2BalanceBAfter = await testTokenB.balanceOf(trader2.address);

      expect(trader1BalanceAAfter).to.equal(trader1BalanceABefore); // trader1 sold TKA
      expect(trader1BalanceBAfter).to.equal(trader1BalanceBBefore + ORDER_AMOUNT); // trader1 received TKB
      expect(trader2BalanceAAfter).to.equal(trader2BalanceABefore + ORDER_AMOUNT); // trader2 received TKA
      expect(trader2BalanceBAfter).to.equal(trader2BalanceBBefore - ORDER_AMOUNT); // trader2 sold TKB

      // Check order status
      const order = await orderBook.getOrder(1);
      expect(order.status).to.equal(2); // Completed
      expect(await orderBook.isOrderActive(1)).to.be.false;
    });

    it("Should revert if insufficient allowance for tokenToBuy", async function () {
      await testTokenB.connect(trader2).approve(trade.target, ORDER_AMOUNT / 2n);

      await expect(
        trade.connect(trader2).executeOrder(1)
      ).to.be.revertedWithCustomError(trade, "InsufficientAllowance");
    });

    it("Should revert if ETH sent with ERC20 trade", async function () {
      await testTokenB.connect(trader2).approve(trade.target, ORDER_AMOUNT);

      await expect(
        trade.connect(trader2).executeOrder(1, { value: ETH_AMOUNT })
      ).to.be.revertedWithCustomError(trade, "ETHSentWithERC20");
    });
  });

  describe("Execute Order - ETH to ERC20", function () {
    beforeEach(async function () {
      // Create order: trader1 sells ETH, buys TKB
      await orderBook.connect(trader1).createOrder(
        ethers.ZeroAddress,
        testTokenB.target,
        ETH_AMOUNT,
        ORDER_AMOUNT,
        { value: ETH_AMOUNT }
      );
    });

    it("Should execute an ETH to ERC20 order successfully", async function () {
      await testTokenB.connect(trader2).approve(trade.target, ORDER_AMOUNT);

      const trader1ETHBefore = await ethers.provider.getBalance(trader1.address);
      const trader1TokenBBefore = await testTokenB.balanceOf(trader1.address);
      const trader2ETHBefore = await ethers.provider.getBalance(trader2.address);
      const trader2TokenBBefore = await testTokenB.balanceOf(trader2.address);

      const tx = await trade.connect(trader2).executeOrder(1);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      await expect(tx).to.emit(trade, "OrderExecuted");

      const trader1ETHAfter = await ethers.provider.getBalance(trader1.address);
      const trader1TokenBAfter = await testTokenB.balanceOf(trader1.address);
      const trader2ETHAfter = await ethers.provider.getBalance(trader2.address);
      const trader2TokenBAfter = await testTokenB.balanceOf(trader2.address);

      expect(trader1ETHAfter).to.equal(trader1ETHBefore); // trader1 sold ETH (already in OrderBook)
      expect(trader1TokenBAfter).to.equal(trader1TokenBBefore + ORDER_AMOUNT); // trader1 received TKB
      expect(trader2ETHAfter).to.equal(trader2ETHBefore + ETH_AMOUNT - gasCost); // trader2 received ETH
      expect(trader2TokenBAfter).to.equal(trader2TokenBBefore - ORDER_AMOUNT); // trader2 sold TKB
    });

    it("Should revert if incorrect ETH amount sent (zero)", async function () {
      await testTokenB.connect(trader2).approve(trade.target, ORDER_AMOUNT);

      // trader2 needs to send 0 ETH (buying ETH with TKB)
      // This should succeed, so let's test the opposite case
      await expect(
        trade.connect(trader2).executeOrder(1, { value: ETH_AMOUNT })
      ).to.be.revertedWithCustomError(trade, "ETHSentWithERC20");
    });
  });

  describe("Execute Order - ERC20 to ETH", function () {
    beforeEach(async function () {
      // Create order: trader1 sells TKA, buys ETH
      await orderBook.connect(trader1).createOrder(
        testTokenA.target,
        ethers.ZeroAddress,
        ORDER_AMOUNT,
        ETH_AMOUNT
      );
    });

    it("Should execute an ERC20 to ETH order successfully", async function () {
      const trader1TokenABefore = await testTokenA.balanceOf(trader1.address);
      const trader1ETHBefore = await ethers.provider.getBalance(trader1.address);
      const trader2TokenABefore = await testTokenA.balanceOf(trader2.address);
      const trader2ETHBefore = await ethers.provider.getBalance(trader2.address);

      const tx = await trade.connect(trader2).executeOrder(1, { value: ETH_AMOUNT });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      await expect(tx).to.emit(trade, "OrderExecuted");

      const trader1TokenAAfter = await testTokenA.balanceOf(trader1.address);
      const trader1ETHAfter = await ethers.provider.getBalance(trader1.address);
      const trader2TokenAAfter = await testTokenA.balanceOf(trader2.address);
      const trader2ETHAfter = await ethers.provider.getBalance(trader2.address);

      expect(trader1TokenAAfter).to.equal(trader1TokenABefore); // trader1 sold TKA
      expect(trader1ETHAfter).to.equal(trader1ETHBefore + ETH_AMOUNT); // trader1 received ETH
      expect(trader2TokenAAfter).to.equal(trader2TokenABefore + ORDER_AMOUNT); // trader2 received TKA
      expect(trader2ETHAfter).to.equal(trader2ETHBefore - ETH_AMOUNT - gasCost); // trader2 sold ETH
    });

    it("Should revert if incorrect ETH amount sent", async function () {
      await expect(
        trade.connect(trader2).executeOrder(1, { value: ETH_AMOUNT / 2n })
      ).to.be.revertedWithCustomError(trade, "IncorrectETHAmount");
    });

    it("Should revert if no ETH sent", async function () {
      await expect(
        trade.connect(trader2).executeOrder(1)
      ).to.be.revertedWithCustomError(trade, "IncorrectETHAmount");
    });
  });

  describe("Order Validations", function () {
    beforeEach(async function () {
      await orderBook.connect(trader1).createOrder(
        testTokenA.target,
        testTokenB.target,
        ORDER_AMOUNT,
        ORDER_AMOUNT
      );
    });

    it("Should revert if order does not exist (zero)", async function () {
      await testTokenB.connect(trader2).approve(trade.target, ORDER_AMOUNT);

      await expect(
        trade.connect(trader2).executeOrder(0)
      ).to.be.revertedWithCustomError(trade, "OrderDoesNotExist");
    });

    it("Should revert if order does not exist (out of range)", async function () {
      await testTokenB.connect(trader2).approve(trade.target, ORDER_AMOUNT);

      await expect(
        trade.connect(trader2).executeOrder(999)
      ).to.be.revertedWithCustomError(trade, "OrderDoesNotExist");
    });

    it("Should revert if order is not active (cancelled)", async function () {
      await testTokenB.connect(trader2).approve(trade.target, ORDER_AMOUNT);
      await orderBook.connect(trader1).cancelOrder(1);

      await expect(
        trade.connect(trader2).executeOrder(1)
      ).to.be.revertedWithCustomError(trade, "OrderNotActive");
    });

    it("Should revert if order is not active (already executed)", async function () {
      await testTokenB.connect(trader2).approve(trade.target, ORDER_AMOUNT);
      await trade.connect(trader2).executeOrder(1);

      // Try to execute again
      await expect(
        trade.connect(trader2).executeOrder(1)
      ).to.be.revertedWithCustomError(trade, "OrderNotActive");
    });

    it("Should revert if creator tries to execute own order", async function () {
      await testTokenB.connect(trader1).approve(trade.target, ORDER_AMOUNT);

      await expect(
        trade.connect(trader1).executeOrder(1)
      ).to.be.revertedWithCustomError(trade, "CannotExecuteOwnOrder");
    });
  });

  describe("View Functions", function () {
    it("Should return ETH balance", async function () {
      const amount = ethers.parseEther("5");
      await owner.sendTransaction({
        to: trade.target,
        value: amount
      });

      expect(await trade.getEthBalance()).to.equal(amount);
    });
  });

  describe("Receive ETH", function () {
    it("Should accept ETH transfers", async function () {
      const amount = ethers.parseEther("2");
      await expect(
        trader1.sendTransaction({
          to: trade.target,
          value: amount
        })
      ).to.not.be.reverted;

      expect(await trade.getEthBalance()).to.equal(amount);
    });
  });

  describe("Integration Tests", function () {
    it("Should handle multiple orders correctly", async function () {
      // Create multiple orders
      await orderBook.connect(trader1).createOrder(
        testTokenA.target,
        testTokenB.target,
        ORDER_AMOUNT,
        ORDER_AMOUNT
      );

      await orderBook.connect(trader1).createOrder(
        testTokenA.target,
        testTokenB.target,
        ORDER_AMOUNT / 2n,
        ORDER_AMOUNT / 2n
      );

      // Execute first order
      await testTokenB.connect(trader2).approve(trade.target, INITIAL_SUPPLY);
      await trade.connect(trader2).executeOrder(1);

      // Verify first order completed
      expect(await orderBook.isOrderActive(1)).to.be.false;

      // Verify second order still active
      expect(await orderBook.isOrderActive(2)).to.be.true;

      // Execute second order
      await trade.connect(trader2).executeOrder(2);

      // Verify second order completed
      expect(await orderBook.isOrderActive(2)).to.be.false;
    });

    it("Should handle order creation and execution with ETH correctly", async function () {
      // trader1 creates order to sell 2 ETH for 200 TKB
      const ethToSell = ethers.parseEther("2");
      const tokensWanted = ethers.parseEther("200");

      await orderBook.connect(trader1).createOrder(
        ethers.ZeroAddress,
        testTokenB.target,
        ethToSell,
        tokensWanted,
        { value: ethToSell }
      );

      // trader2 executes the order
      await testTokenB.connect(trader2).approve(trade.target, tokensWanted);

      const trader2ETHBefore = await ethers.provider.getBalance(trader2.address);
      const tx = await trade.connect(trader2).executeOrder(1);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const trader2ETHAfter = await ethers.provider.getBalance(trader2.address);

      // trader2 should receive the ETH
      expect(trader2ETHAfter).to.equal(trader2ETHBefore + ethToSell - gasCost);

      // trader1 should receive the tokens
      expect(await testTokenB.balanceOf(trader1.address)).to.equal(tokensWanted);
    });
  });
});
