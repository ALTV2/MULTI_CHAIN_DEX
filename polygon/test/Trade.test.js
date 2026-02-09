const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Trade", function () {
  let tokenManager;
  let orderBook;
  let trade;
  let tokenA;
  let tokenB;
  let owner;
  let alice;
  let bob;

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    // Deploy TokenManager
    const TokenManager = await ethers.getContractFactory("contracts/core/TokenManager.sol:TokenManager");
    tokenManager = await TokenManager.deploy(owner.address);
    await tokenManager.waitForDeployment();

    // Deploy OrderBook
    const OrderBook = await ethers.getContractFactory("contracts/core/OrderBook.sol:OrderBook");
    orderBook = await OrderBook.deploy(await tokenManager.getAddress());
    await orderBook.waitForDeployment();

    // Deploy Trade
    const Trade = await ethers.getContractFactory("contracts/core/Trade.sol:Trade");
    trade = await Trade.deploy(await orderBook.getAddress());
    await trade.waitForDeployment();

    // Set trade contract in OrderBook
    await orderBook.setTradeContract(await trade.getAddress());

    // Deploy test tokens
    const TestERC20 = await ethers.getContractFactory("contracts/tokens/TestERC20.sol:TestERC20");
    tokenA = await TestERC20.deploy("Token A", "TKA", 18);
    await tokenA.waitForDeployment();
    tokenB = await TestERC20.deploy("Token B", "TKB", 18);
    await tokenB.waitForDeployment();

    // Mint tokens
    await tokenA.mint(alice.address, ethers.parseEther("1000"));
    await tokenA.mint(bob.address, ethers.parseEther("1000"));
    await tokenB.mint(alice.address, ethers.parseEther("1000"));
    await tokenB.mint(bob.address, ethers.parseEther("1000"));
  });

  describe("Deployment", function () {
    it("should set correct order book", async function () {
      expect(await trade.ORDER_BOOK()).to.equal(await orderBook.getAddress());
    });

    it("should revert with zero address order book", async function () {
      const Trade = await ethers.getContractFactory("contracts/core/Trade.sol:Trade");
      await expect(
        Trade.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(trade, "InvalidOrderBookAddress");
    });
  });

  describe("executeOrder - ERC20 to ERC20", function () {
    const sellAmount = ethers.parseEther("100");
    const buyAmount = ethers.parseEther("200");

    beforeEach(async function () {
      // Alice creates order: sell 100 TokenA, buy 200 TokenB
      await tokenA.connect(alice).approve(await orderBook.getAddress(), sellAmount);
      await orderBook.connect(alice).createOrder(
        await tokenA.getAddress(), await tokenB.getAddress(), sellAmount, buyAmount
      );
    });

    it("should execute order successfully", async function () {
      // Bob approves TokenB to Trade contract
      await tokenB.connect(bob).approve(await trade.getAddress(), buyAmount);

      const aliceTokenBBefore = await tokenB.balanceOf(alice.address);
      const bobTokenABefore = await tokenA.balanceOf(bob.address);

      await expect(trade.connect(bob).executeOrder(1))
        .to.emit(trade, "OrderExecuted");

      // Alice should receive buyAmount of TokenB
      const aliceTokenBAfter = await tokenB.balanceOf(alice.address);
      expect(aliceTokenBAfter - aliceTokenBBefore).to.equal(buyAmount);

      // Bob should receive sellAmount of TokenA
      const bobTokenAAfter = await tokenA.balanceOf(bob.address);
      expect(bobTokenAAfter - bobTokenABefore).to.equal(sellAmount);

      // Order should be completed
      const order = await orderBook.getOrder(1);
      expect(order.status).to.equal(2); // Completed
    });

    it("should revert if executor is creator", async function () {
      await tokenB.connect(alice).approve(await trade.getAddress(), buyAmount);
      await expect(
        trade.connect(alice).executeOrder(1)
      ).to.be.revertedWithCustomError(trade, "CannotExecuteOwnOrder");
    });

    it("should revert if order does not exist", async function () {
      await expect(
        trade.connect(bob).executeOrder(999)
      ).to.be.revertedWithCustomError(trade, "OrderDoesNotExist");
    });

    it("should revert with insufficient allowance", async function () {
      await expect(
        trade.connect(bob).executeOrder(1)
      ).to.be.revertedWithCustomError(trade, "InsufficientAllowance");
    });

    it("should revert if MATIC sent with ERC20 buy", async function () {
      await tokenB.connect(bob).approve(await trade.getAddress(), buyAmount);
      await expect(
        trade.connect(bob).executeOrder(1, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(trade, "MATICSentWithERC20");
    });
  });

  describe("executeOrder - MATIC sell / ERC20 buy", function () {
    const sellAmount = ethers.parseEther("1");
    const buyAmount = ethers.parseEther("100");

    beforeEach(async function () {
      // Alice creates order: sell 1 MATIC, buy 100 TokenB
      await orderBook.connect(alice).createOrder(
        ethers.ZeroAddress, await tokenB.getAddress(), sellAmount, buyAmount,
        { value: sellAmount }
      );
    });

    it("should execute MATIC sell order", async function () {
      await tokenB.connect(bob).approve(await trade.getAddress(), buyAmount);

      const bobBalanceBefore = await ethers.provider.getBalance(bob.address);

      const tx = await trade.connect(bob).executeOrder(1);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const bobBalanceAfter = await ethers.provider.getBalance(bob.address);
      // Bob should receive sellAmount MATIC minus gas
      expect(bobBalanceAfter + gasCost - bobBalanceBefore).to.equal(sellAmount);
    });
  });

  describe("executeOrder - ERC20 sell / MATIC buy", function () {
    const sellAmount = ethers.parseEther("100");
    const buyAmount = ethers.parseEther("1");

    beforeEach(async function () {
      // Alice creates order: sell 100 TokenA, buy 1 MATIC
      await tokenA.connect(alice).approve(await orderBook.getAddress(), sellAmount);
      await orderBook.connect(alice).createOrder(
        await tokenA.getAddress(), ethers.ZeroAddress, sellAmount, buyAmount
      );
    });

    it("should execute MATIC buy order", async function () {
      const aliceBalanceBefore = await ethers.provider.getBalance(alice.address);

      await expect(
        trade.connect(bob).executeOrder(1, { value: buyAmount })
      ).to.emit(trade, "OrderExecuted");

      // Alice should receive buyAmount MATIC
      const aliceBalanceAfter = await ethers.provider.getBalance(alice.address);
      expect(aliceBalanceAfter - aliceBalanceBefore).to.equal(buyAmount);

      // Bob should receive sellAmount TokenA
      const bobTokenA = await tokenA.balanceOf(bob.address);
      expect(bobTokenA).to.equal(ethers.parseEther("1000") + sellAmount);
    });

    it("should revert with incorrect MATIC amount", async function () {
      await expect(
        trade.connect(bob).executeOrder(1, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWithCustomError(trade, "IncorrectMATICAmount");
    });
  });

  describe("executeOrder - cancelled order", function () {
    it("should revert if order is cancelled", async function () {
      const sellAmount = ethers.parseEther("100");
      await tokenA.connect(alice).approve(await orderBook.getAddress(), sellAmount);
      await orderBook.connect(alice).createOrder(
        await tokenA.getAddress(), await tokenB.getAddress(), sellAmount, ethers.parseEther("200")
      );

      await orderBook.connect(alice).cancelOrder(1);

      await tokenB.connect(bob).approve(await trade.getAddress(), ethers.parseEther("200"));
      await expect(
        trade.connect(bob).executeOrder(1)
      ).to.be.revertedWithCustomError(trade, "OrderNotActive");
    });
  });

  describe("View functions", function () {
    it("should return MATIC balance", async function () {
      expect(await trade.getMaticBalance()).to.equal(0);
    });
  });
});
