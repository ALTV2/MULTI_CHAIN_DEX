const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OrderBook", function () {
  let tokenManager;
  let orderBook;
  let tokenA;
  let tokenB;
  let owner;
  let alice;
  let bob;
  let tradeContract;

  beforeEach(async function () {
    [owner, alice, bob, tradeContract] = await ethers.getSigners();

    // Deploy TokenManager
    const TokenManager = await ethers.getContractFactory("contracts/core/TokenManager.sol:TokenManager");
    tokenManager = await TokenManager.deploy(owner.address);
    await tokenManager.waitForDeployment();

    // Deploy OrderBook
    const OrderBook = await ethers.getContractFactory("contracts/core/OrderBook.sol:OrderBook");
    orderBook = await OrderBook.deploy(await tokenManager.getAddress());
    await orderBook.waitForDeployment();

    // Deploy test tokens
    const TestERC20 = await ethers.getContractFactory("contracts/tokens/TestERC20.sol:TestERC20");
    tokenA = await TestERC20.deploy("Token A", "TKA", 18);
    await tokenA.waitForDeployment();
    tokenB = await TestERC20.deploy("Token B", "TKB", 18);
    await tokenB.waitForDeployment();

    // Mint tokens
    await tokenA.mint(alice.address, ethers.parseEther("1000"));
    await tokenB.mint(bob.address, ethers.parseEther("1000"));

    // Set trade contract
    await orderBook.setTradeContract(tradeContract.address);
  });

  describe("Deployment", function () {
    it("should set correct token manager", async function () {
      expect(await orderBook.TOKEN_MANAGER()).to.equal(await tokenManager.getAddress());
    });

    it("should set correct owner", async function () {
      expect(await orderBook.owner()).to.equal(owner.address);
    });

    it("should have restrictTokens disabled by default", async function () {
      expect(await orderBook.restrictTokens()).to.be.false;
    });

    it("should revert with zero address token manager", async function () {
      const OrderBook = await ethers.getContractFactory("contracts/core/OrderBook.sol:OrderBook");
      await expect(
        OrderBook.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(orderBook, "InvalidTokenManager");
    });
  });

  describe("createOrder - ERC20 to ERC20", function () {
    it("should create an order successfully", async function () {
      const sellAmount = ethers.parseEther("100");
      const buyAmount = ethers.parseEther("200");

      await tokenA.connect(alice).approve(await orderBook.getAddress(), sellAmount);

      await expect(
        orderBook.connect(alice).createOrder(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          sellAmount,
          buyAmount
        )
      ).to.emit(orderBook, "OrderCreated");

      const order = await orderBook.getOrder(1);
      expect(order.creator).to.equal(alice.address);
      expect(order.tokenToSell).to.equal(await tokenA.getAddress());
      expect(order.tokenToBuy).to.equal(await tokenB.getAddress());
      expect(order.sellAmount).to.equal(sellAmount);
      expect(order.buyAmount).to.equal(buyAmount);
      expect(order.status).to.equal(0); // Active
    });

    it("should increment order counter", async function () {
      const sellAmount = ethers.parseEther("100");
      const buyAmount = ethers.parseEther("200");

      await tokenA.connect(alice).approve(await orderBook.getAddress(), sellAmount * 2n);

      await orderBook.connect(alice).createOrder(
        await tokenA.getAddress(), await tokenB.getAddress(), sellAmount, buyAmount
      );
      await orderBook.connect(alice).createOrder(
        await tokenA.getAddress(), await tokenB.getAddress(), sellAmount, buyAmount
      );

      expect(await orderBook.orderCounter()).to.equal(2);
    });

    it("should revert with zero amounts", async function () {
      await expect(
        orderBook.connect(alice).createOrder(
          await tokenA.getAddress(), await tokenB.getAddress(), 0, ethers.parseEther("1")
        )
      ).to.be.revertedWithCustomError(orderBook, "InvalidAmounts");
    });

    it("should revert with same token", async function () {
      const addr = await tokenA.getAddress();
      await expect(
        orderBook.connect(alice).createOrder(addr, addr, ethers.parseEther("1"), ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(orderBook, "SameAssetTrade");
    });

    it("should revert if MATIC sent with ERC20 order", async function () {
      await tokenA.connect(alice).approve(await orderBook.getAddress(), ethers.parseEther("100"));
      await expect(
        orderBook.connect(alice).createOrder(
          await tokenA.getAddress(), await tokenB.getAddress(),
          ethers.parseEther("100"), ethers.parseEther("200"),
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWithCustomError(orderBook, "MATICSentWithERC20");
    });

    it("should revert with insufficient allowance", async function () {
      await expect(
        orderBook.connect(alice).createOrder(
          await tokenA.getAddress(), await tokenB.getAddress(),
          ethers.parseEther("100"), ethers.parseEther("200")
        )
      ).to.be.revertedWithCustomError(orderBook, "InsufficientAllowance");
    });
  });

  describe("createOrder - MATIC orders", function () {
    it("should create a MATIC sell order", async function () {
      const sellAmount = ethers.parseEther("1");
      const buyAmount = ethers.parseEther("100");

      await expect(
        orderBook.connect(alice).createOrder(
          ethers.ZeroAddress, await tokenA.getAddress(), sellAmount, buyAmount,
          { value: sellAmount }
        )
      ).to.emit(orderBook, "OrderCreated");

      const order = await orderBook.getOrder(1);
      expect(order.tokenToSell).to.equal(ethers.ZeroAddress);
      expect(order.sellAmount).to.equal(sellAmount);
    });

    it("should revert with incorrect MATIC amount", async function () {
      await expect(
        orderBook.connect(alice).createOrder(
          ethers.ZeroAddress, await tokenA.getAddress(),
          ethers.parseEther("1"), ethers.parseEther("100"),
          { value: ethers.parseEther("0.5") }
        )
      ).to.be.revertedWithCustomError(orderBook, "IncorrectMATICAmount");
    });
  });

  describe("createOrder - with token restriction", function () {
    beforeEach(async function () {
      await orderBook.toggleTokenRestriction(true);
      await tokenManager.addToken(await tokenA.getAddress());
    });

    it("should allow order with supported token", async function () {
      const sellAmount = ethers.parseEther("100");
      await tokenA.connect(alice).approve(await orderBook.getAddress(), sellAmount);

      await expect(
        orderBook.connect(alice).createOrder(
          await tokenA.getAddress(), ethers.ZeroAddress, sellAmount, ethers.parseEther("1")
        )
      ).to.emit(orderBook, "OrderCreated");
    });

    it("should revert with unsupported token", async function () {
      const sellAmount = ethers.parseEther("100");
      await tokenB.connect(bob).approve(await orderBook.getAddress(), sellAmount);

      await expect(
        orderBook.connect(bob).createOrder(
          await tokenB.getAddress(), ethers.ZeroAddress, sellAmount, ethers.parseEther("1")
        )
      ).to.be.revertedWithCustomError(orderBook, "TokenNotSupported");
    });
  });

  describe("cancelOrder", function () {
    beforeEach(async function () {
      const sellAmount = ethers.parseEther("100");
      await tokenA.connect(alice).approve(await orderBook.getAddress(), sellAmount);
      await orderBook.connect(alice).createOrder(
        await tokenA.getAddress(), await tokenB.getAddress(), sellAmount, ethers.parseEther("200")
      );
    });

    it("should cancel an order and return tokens", async function () {
      const balanceBefore = await tokenA.balanceOf(alice.address);

      await expect(orderBook.connect(alice).cancelOrder(1))
        .to.emit(orderBook, "OrderCancelled");

      const balanceAfter = await tokenA.balanceOf(alice.address);
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("100"));

      const order = await orderBook.getOrder(1);
      expect(order.status).to.equal(3); // Cancelled
    });

    it("should cancel MATIC order and return MATIC", async function () {
      const maticAmount = ethers.parseEther("1");
      await orderBook.connect(alice).createOrder(
        ethers.ZeroAddress, await tokenA.getAddress(), maticAmount, ethers.parseEther("100"),
        { value: maticAmount }
      );

      const balanceBefore = await ethers.provider.getBalance(alice.address);
      const tx = await orderBook.connect(alice).cancelOrder(2);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(alice.address);

      expect(balanceAfter + gasCost - balanceBefore).to.equal(maticAmount);
    });

    it("should revert if order does not exist", async function () {
      await expect(
        orderBook.connect(alice).cancelOrder(999)
      ).to.be.revertedWithCustomError(orderBook, "OrderDoesNotExist");
    });

    it("should revert if not order creator", async function () {
      await expect(
        orderBook.connect(bob).cancelOrder(1)
      ).to.be.revertedWithCustomError(orderBook, "NotOrderCreator");
    });

    it("should revert if order not active", async function () {
      await orderBook.connect(alice).cancelOrder(1);
      await expect(
        orderBook.connect(alice).cancelOrder(1)
      ).to.be.revertedWithCustomError(orderBook, "OrderNotActive");
    });
  });

  describe("setTradeContract", function () {
    it("should set trade contract", async function () {
      const newTrade = bob.address;
      await expect(orderBook.setTradeContract(newTrade))
        .to.emit(orderBook, "TradeContractUpdated");
      expect(await orderBook.tradeContract()).to.equal(newTrade);
    });

    it("should revert with zero address", async function () {
      await expect(
        orderBook.setTradeContract(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(orderBook, "InvalidTradeContract");
    });

    it("should revert if non-owner", async function () {
      await expect(
        orderBook.connect(alice).setTradeContract(bob.address)
      ).to.be.revertedWithCustomError(orderBook, "OwnableUnauthorizedAccount");
    });
  });

  describe("toggleTokenRestriction", function () {
    it("should toggle restriction on", async function () {
      await expect(orderBook.toggleTokenRestriction(true))
        .to.emit(orderBook, "TokenRestrictionToggled");
      expect(await orderBook.restrictTokens()).to.be.true;
    });

    it("should revert if already same value", async function () {
      await expect(
        orderBook.toggleTokenRestriction(false)
      ).to.be.revertedWithCustomError(orderBook, "RestrictionAlreadySet");
    });
  });

  describe("deactivateOrder", function () {
    it("should deactivate order from trade contract", async function () {
      const sellAmount = ethers.parseEther("100");
      await tokenA.connect(alice).approve(await orderBook.getAddress(), sellAmount);
      await orderBook.connect(alice).createOrder(
        await tokenA.getAddress(), await tokenB.getAddress(), sellAmount, ethers.parseEther("200")
      );

      await expect(orderBook.connect(tradeContract).deactivateOrder(1))
        .to.emit(orderBook, "OrderExecuted");
    });

    it("should revert if not trade contract", async function () {
      const sellAmount = ethers.parseEther("100");
      await tokenA.connect(alice).approve(await orderBook.getAddress(), sellAmount);
      await orderBook.connect(alice).createOrder(
        await tokenA.getAddress(), await tokenB.getAddress(), sellAmount, ethers.parseEther("200")
      );

      await expect(
        orderBook.connect(alice).deactivateOrder(1)
      ).to.be.revertedWithCustomError(orderBook, "OnlyTradeContract");
    });
  });

  describe("View functions", function () {
    it("should return order active status", async function () {
      const sellAmount = ethers.parseEther("100");
      await tokenA.connect(alice).approve(await orderBook.getAddress(), sellAmount);
      await orderBook.connect(alice).createOrder(
        await tokenA.getAddress(), await tokenB.getAddress(), sellAmount, ethers.parseEther("200")
      );

      expect(await orderBook.isOrderActive(1)).to.be.true;
      expect(await orderBook.isOrderActive(999)).to.be.false;
    });

    it("should return MATIC balance", async function () {
      const maticAmount = ethers.parseEther("1");
      await orderBook.connect(alice).createOrder(
        ethers.ZeroAddress, await tokenA.getAddress(), maticAmount, ethers.parseEther("100"),
        { value: maticAmount }
      );

      expect(await orderBook.getMaticBalance()).to.equal(maticAmount);
    });
  });
});
