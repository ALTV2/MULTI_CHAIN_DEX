const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OrderBook", function () {
  let orderBook;
  let tokenManager;
  let testTokenA;
  let testTokenB;
  let owner;
  let trader1;
  let trader2;
  let tradeContract;

  const INITIAL_SUPPLY = ethers.parseEther("10000");
  const ORDER_AMOUNT = ethers.parseEther("100");
  const ETH_AMOUNT = ethers.parseEther("1");

  beforeEach(async function () {
    [owner, trader1, trader2, tradeContract] = await ethers.getSigners();

    // Deploy TokenManager
    const TokenManager = await ethers.getContractFactory("TokenManager");
    tokenManager = await TokenManager.deploy(owner.address);
    await tokenManager.waitForDeployment();

    // Deploy OrderBook
    const OrderBook = await ethers.getContractFactory("OrderBook");
    orderBook = await OrderBook.deploy(tokenManager.target);
    await orderBook.waitForDeployment();

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
    it("Should set the right token manager", async function () {
      expect(await orderBook.TOKEN_MANAGER()).to.equal(tokenManager.target);
    });

    it("Should set the right owner", async function () {
      expect(await orderBook.owner()).to.equal(owner.address);
    });

    it("Should initialize restrictTokens as false", async function () {
      expect(await orderBook.restrictTokens()).to.be.false;
    });

    it("Should revert if initialized with zero address", async function () {
      const OrderBook = await ethers.getContractFactory("OrderBook");
      await expect(
        OrderBook.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(orderBook, "InvalidTokenManager");
    });
  });

  describe("Creating Orders", function () {
    describe("ERC20 to ERC20", function () {
      it("Should create an order successfully", async function () {
        const tx = await orderBook.connect(trader1).createOrder(
          testTokenA.target,
          testTokenB.target,
          ORDER_AMOUNT,
          ORDER_AMOUNT
        );

        const receipt = await tx.wait();
        const block = await ethers.provider.getBlock(receipt.blockNumber);

        await expect(tx)
          .to.emit(orderBook, "OrderCreated")
          .withArgs(1, trader1.address, testTokenA.target, testTokenB.target, ORDER_AMOUNT, ORDER_AMOUNT, block.timestamp);

        const order = await orderBook.getOrder(1);
        expect(order.id).to.equal(1);
        expect(order.creator).to.equal(trader1.address);
        expect(order.tokenToSell).to.equal(testTokenA.target);
        expect(order.tokenToBuy).to.equal(testTokenB.target);
        expect(order.sellAmount).to.equal(ORDER_AMOUNT);
        expect(order.buyAmount).to.equal(ORDER_AMOUNT);
        expect(order.status).to.equal(0); // Active

        expect(await orderBook.orderCounter()).to.equal(1);
        expect(await orderBook.isOrderActive(1)).to.be.true;
      });

      it("Should transfer tokens to OrderBook", async function () {
        const balanceBefore = await testTokenA.balanceOf(orderBook.target);

        await orderBook.connect(trader1).createOrder(
          testTokenA.target,
          testTokenB.target,
          ORDER_AMOUNT,
          ORDER_AMOUNT
        );

        const balanceAfter = await testTokenA.balanceOf(orderBook.target);
        expect(balanceAfter - balanceBefore).to.equal(ORDER_AMOUNT);
      });
    });

    describe("ETH to ERC20", function () {
      it("Should create an ETH sell order", async function () {
        const tx = await orderBook.connect(trader1).createOrder(
          ethers.ZeroAddress,
          testTokenB.target,
          ETH_AMOUNT,
          ORDER_AMOUNT,
          { value: ETH_AMOUNT }
        );

        await expect(tx).to.emit(orderBook, "OrderCreated");

        const order = await orderBook.getOrder(1);
        expect(order.tokenToSell).to.equal(ethers.ZeroAddress);
        expect(order.sellAmount).to.equal(ETH_AMOUNT);
      });

      it("Should revert if incorrect ETH amount sent", async function () {
        await expect(
          orderBook.connect(trader1).createOrder(
            ethers.ZeroAddress,
            testTokenB.target,
            ETH_AMOUNT,
            ORDER_AMOUNT,
            { value: ETH_AMOUNT / 2n }
          )
        ).to.be.revertedWithCustomError(orderBook, "IncorrectETHAmount");
      });
    });

    describe("ERC20 to ETH", function () {
      it("Should create an ETH buy order", async function () {
        await orderBook.connect(trader1).createOrder(
          testTokenA.target,
          ethers.ZeroAddress,
          ORDER_AMOUNT,
          ETH_AMOUNT
        );

        const order = await orderBook.getOrder(1);
        expect(order.tokenToBuy).to.equal(ethers.ZeroAddress);
        expect(order.buyAmount).to.equal(ETH_AMOUNT);
      });

      it("Should revert if ETH sent with ERC20 sell", async function () {
        await expect(
          orderBook.connect(trader1).createOrder(
            testTokenA.target,
            testTokenB.target,
            ORDER_AMOUNT,
            ORDER_AMOUNT,
            { value: ETH_AMOUNT }
          )
        ).to.be.revertedWithCustomError(orderBook, "ETHSentWithERC20");
      });
    });

    describe("Validations", function () {
      it("Should revert if sell amount is zero", async function () {
        await expect(
          orderBook.connect(trader1).createOrder(
            testTokenA.target,
            testTokenB.target,
            0,
            ORDER_AMOUNT
          )
        ).to.be.revertedWithCustomError(orderBook, "InvalidAmounts");
      });

      it("Should revert if buy amount is zero", async function () {
        await expect(
          orderBook.connect(trader1).createOrder(
            testTokenA.target,
            testTokenB.target,
            ORDER_AMOUNT,
            0
          )
        ).to.be.revertedWithCustomError(orderBook, "InvalidAmounts");
      });

      it("Should revert if trading same asset", async function () {
        await expect(
          orderBook.connect(trader1).createOrder(
            testTokenA.target,
            testTokenA.target,
            ORDER_AMOUNT,
            ORDER_AMOUNT
          )
        ).to.be.revertedWithCustomError(orderBook, "SameAssetTrade");
      });

      it("Should revert if insufficient allowance", async function () {
        await testTokenA.connect(trader1).approve(orderBook.target, 0);

        await expect(
          orderBook.connect(trader1).createOrder(
            testTokenA.target,
            testTokenB.target,
            ORDER_AMOUNT,
            ORDER_AMOUNT
          )
        ).to.be.revertedWithCustomError(orderBook, "InsufficientAllowance");
      });
    });

    describe("Token Restriction", function () {
      beforeEach(async function () {
        await orderBook.toggleTokenRestriction(true);
        await tokenManager.addToken(testTokenA.target);
      });

      it("Should allow order with supported tokens", async function () {
        await tokenManager.addToken(testTokenB.target);

        await expect(
          orderBook.connect(trader1).createOrder(
            testTokenA.target,
            testTokenB.target,
            ORDER_AMOUNT,
            ORDER_AMOUNT
          )
        ).to.not.be.reverted;
      });

      it("Should revert if tokenToSell not supported", async function () {
        await expect(
          orderBook.connect(trader1).createOrder(
            testTokenB.target, // Not supported
            testTokenA.target,
            ORDER_AMOUNT,
            ORDER_AMOUNT
          )
        ).to.be.revertedWithCustomError(orderBook, "TokenNotSupported");
      });

      it("Should revert if tokenToBuy not supported", async function () {
        await expect(
          orderBook.connect(trader1).createOrder(
            testTokenA.target,
            testTokenB.target, // Not supported
            ORDER_AMOUNT,
            ORDER_AMOUNT
          )
        ).to.be.revertedWithCustomError(orderBook, "TokenNotSupported");
      });

      it("Should allow ETH orders even with restrictions", async function () {
        await expect(
          orderBook.connect(trader1).createOrder(
            ethers.ZeroAddress,
            testTokenA.target,
            ETH_AMOUNT,
            ORDER_AMOUNT,
            { value: ETH_AMOUNT }
          )
        ).to.not.be.reverted;
      });
    });
  });

  describe("Canceling Orders", function () {
    beforeEach(async function () {
      await orderBook.connect(trader1).createOrder(
        testTokenA.target,
        testTokenB.target,
        ORDER_AMOUNT,
        ORDER_AMOUNT
      );
    });

    it("Should cancel an order and return tokens", async function () {
      const balanceBefore = await testTokenA.balanceOf(trader1.address);

      await expect(orderBook.connect(trader1).cancelOrder(1))
        .to.emit(orderBook, "OrderCancelled");

      const order = await orderBook.getOrder(1);
      expect(order.status).to.equal(3); // Cancelled
      expect(order.sellAmount).to.equal(0);

      const balanceAfter = await testTokenA.balanceOf(trader1.address);
      expect(balanceAfter - balanceBefore).to.equal(ORDER_AMOUNT);

      expect(await orderBook.isOrderActive(1)).to.be.false;
    });

    it("Should cancel ETH order and return ETH", async function () {
      await orderBook.connect(trader1).createOrder(
        ethers.ZeroAddress,
        testTokenB.target,
        ETH_AMOUNT,
        ORDER_AMOUNT,
        { value: ETH_AMOUNT }
      );

      const balanceBefore = await ethers.provider.getBalance(trader1.address);
      const tx = await orderBook.connect(trader1).cancelOrder(2);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(trader1.address);
      expect(balanceAfter - balanceBefore + gasCost).to.equal(ETH_AMOUNT);
    });

    it("Should revert if order does not exist (zero)", async function () {
      await expect(
        orderBook.connect(trader1).cancelOrder(0)
      ).to.be.revertedWithCustomError(orderBook, "OrderDoesNotExist");
    });

    it("Should revert if order does not exist (out of range)", async function () {
      await expect(
        orderBook.connect(trader1).cancelOrder(999)
      ).to.be.revertedWithCustomError(orderBook, "OrderDoesNotExist");
    });

    it("Should revert if order is not active", async function () {
      await orderBook.connect(trader1).cancelOrder(1);

      await expect(
        orderBook.connect(trader1).cancelOrder(1)
      ).to.be.revertedWithCustomError(orderBook, "OrderNotActive");
    });

    it("Should revert if caller is not order creator", async function () {
      await expect(
        orderBook.connect(trader2).cancelOrder(1)
      ).to.be.revertedWithCustomError(orderBook, "NotOrderCreator");
    });
  });

  describe("Trade Contract Management", function () {
    it("Should set trade contract", async function () {
      await expect(orderBook.setTradeContract(tradeContract.address))
        .to.emit(orderBook, "TradeContractUpdated");

      expect(await orderBook.tradeContract()).to.equal(tradeContract.address);
    });

    it("Should revert if setting zero address", async function () {
      await expect(
        orderBook.setTradeContract(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(orderBook, "InvalidTradeContract");
    });

    it("Should revert if non-owner tries to set trade contract", async function () {
      await expect(
        orderBook.connect(trader1).setTradeContract(tradeContract.address)
      ).to.be.revertedWithCustomError(orderBook, "OwnableUnauthorizedAccount");
    });

    describe("Trade Contract Functions", function () {
      beforeEach(async function () {
        await orderBook.setTradeContract(tradeContract.address);
        await orderBook.connect(trader1).createOrder(
          testTokenA.target,
          testTokenB.target,
          ORDER_AMOUNT,
          ORDER_AMOUNT
        );
      });

      it("Should allow trade contract to deactivate order", async function () {
        await expect(orderBook.connect(tradeContract).deactivateOrder(1))
          .to.emit(orderBook, "OrderExecuted");

        const order = await orderBook.getOrder(1);
        expect(order.status).to.equal(2); // Completed
      });

      it("Should revert if non-trade contract tries to deactivate", async function () {
        await expect(
          orderBook.connect(trader1).deactivateOrder(1)
        ).to.be.revertedWithCustomError(orderBook, "OnlyTradeContract");
      });

      it("Should move tokens to trade contract", async function () {
        const balanceBefore = await testTokenA.balanceOf(tradeContract.address);

        await orderBook.connect(tradeContract).moveTokensToTradeContract(1);

        const balanceAfter = await testTokenA.balanceOf(tradeContract.address);
        expect(balanceAfter - balanceBefore).to.equal(ORDER_AMOUNT);

        const order = await orderBook.getOrder(1);
        expect(order.status).to.equal(1); // Pending
        expect(order.sellAmount).to.equal(0);
      });

      it("Should move ETH to trade contract", async function () {
        await orderBook.connect(trader1).createOrder(
          ethers.ZeroAddress,
          testTokenB.target,
          ETH_AMOUNT,
          ORDER_AMOUNT,
          { value: ETH_AMOUNT }
        );

        const balanceBefore = await ethers.provider.getBalance(tradeContract.address);
        const tx = await orderBook.connect(tradeContract).moveTokensToTradeContract(2);
        const receipt = await tx.wait();
        const gasCost = receipt.gasUsed * receipt.gasPrice;
        const balanceAfter = await ethers.provider.getBalance(tradeContract.address);

        // tradeContract receives ETH but pays gas for the transaction
        expect(balanceAfter - balanceBefore + gasCost).to.equal(ETH_AMOUNT);
      });

      it("Should revert if trying to move tokens twice", async function () {
        await orderBook.connect(tradeContract).moveTokensToTradeContract(1);

        // After moving tokens, order status becomes Pending
        await expect(
          orderBook.connect(tradeContract).moveTokensToTradeContract(1)
        ).to.be.revertedWithCustomError(orderBook, "OrderNotActive");
      });
    });
  });

  describe("Token Restriction Toggle", function () {
    it("Should toggle token restriction", async function () {
      await expect(orderBook.toggleTokenRestriction(true))
        .to.emit(orderBook, "TokenRestrictionToggled");

      expect(await orderBook.restrictTokens()).to.be.true;
    });

    it("Should revert if setting same value", async function () {
      await expect(
        orderBook.toggleTokenRestriction(false)
      ).to.be.revertedWithCustomError(orderBook, "RestrictionAlreadySet");
    });

    it("Should revert if non-owner tries to toggle", async function () {
      await expect(
        orderBook.connect(trader1).toggleTokenRestriction(true)
      ).to.be.revertedWithCustomError(orderBook, "OwnableUnauthorizedAccount");
    });
  });

  describe("View Functions", function () {
    it("Should return ETH balance", async function () {
      await orderBook.connect(trader1).createOrder(
        ethers.ZeroAddress,
        testTokenB.target,
        ETH_AMOUNT,
        ORDER_AMOUNT,
        { value: ETH_AMOUNT }
      );

      expect(await orderBook.getEthBalance()).to.equal(ETH_AMOUNT);
    });

    it("Should check if order is active", async function () {
      await orderBook.connect(trader1).createOrder(
        testTokenA.target,
        testTokenB.target,
        ORDER_AMOUNT,
        ORDER_AMOUNT
      );

      expect(await orderBook.isOrderActive(1)).to.be.true;
      expect(await orderBook.isOrderActive(0)).to.be.false;
      expect(await orderBook.isOrderActive(999)).to.be.false;
    });
  });

  describe("Receive ETH", function () {
    it("Should accept ETH transfers", async function () {
      const amount = ethers.parseEther("1");
      await expect(
        trader1.sendTransaction({
          to: orderBook.target,
          value: amount
        })
      ).to.not.be.reverted;

      expect(await orderBook.getEthBalance()).to.equal(amount);
    });
  });
});
