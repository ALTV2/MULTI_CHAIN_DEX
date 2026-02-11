const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CrossChainOrderBook", function () {
  let ccob;
  let owner;
  let alice;
  let bob;
  let matcher;

  const POLYGON_CHAIN_ID = 80002n; // Polygon Amoy
  const ONE_HOUR = 3600;
  const ONE_DAY = 86400;
  const MIN_TIMELOCK = ONE_HOUR;

  beforeEach(async function () {
    [owner, alice, bob, matcher] = await ethers.getSigners();

    // Deploy CrossChainOrderBook
    const CrossChainOrderBook = await ethers.getContractFactory(
      "contracts/htlc/CrossChainOrderBook.sol:CrossChainOrderBook"
    );
    ccob = await CrossChainOrderBook.deploy();
    await ccob.waitForDeployment();

    // Add Polygon Amoy as supported chain
    await ccob.addSupportedChain(POLYGON_CHAIN_ID);
  });

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      expect(await ccob.owner()).to.equal(owner.address);
    });

    it("should initialize nextOrderId to 1", async function () {
      expect(await ccob.nextOrderId()).to.equal(1);
    });

    it("should support current chain by default", async function () {
      const chainId = await ccob.getChainId();
      expect(await ccob.supportedChains(chainId)).to.be.true;
    });
  });

  describe("Chain Management", function () {
    it("should add supported chain", async function () {
      const newChainId = 11155111n; // Sepolia

      await expect(ccob.addSupportedChain(newChainId))
        .to.emit(ccob, "ChainAdded")
        .withArgs(newChainId);

      expect(await ccob.supportedChains(newChainId)).to.be.true;
    });

    it("should not emit event when adding already supported chain", async function () {
      await ccob.addSupportedChain(100n);

      // Adding same chain again should not emit event
      const tx = await ccob.addSupportedChain(100n);
      const receipt = await tx.wait();
      expect(receipt.logs.length).to.equal(0);
    });

    it("should remove supported chain", async function () {
      await expect(ccob.removeSupportedChain(POLYGON_CHAIN_ID))
        .to.emit(ccob, "ChainRemoved")
        .withArgs(POLYGON_CHAIN_ID);

      expect(await ccob.supportedChains(POLYGON_CHAIN_ID)).to.be.false;
    });

    it("should only allow owner to add chains", async function () {
      await expect(
        ccob.connect(alice).addSupportedChain(100n)
      ).to.be.revertedWithCustomError(ccob, "OwnableUnauthorizedAccount");
    });

    it("should only allow owner to remove chains", async function () {
      await expect(
        ccob.connect(alice).removeSupportedChain(POLYGON_CHAIN_ID)
      ).to.be.revertedWithCustomError(ccob, "OwnableUnauthorizedAccount");
    });

    it("should return all supported chains", async function () {
      const chains = await ccob.getSupportedChains();
      expect(chains.length).to.be.gte(1);
    });
  });

  describe("Creating Orders", function () {
    it("should create a cross-chain order successfully", async function () {
      const expiresAt = (await time.latest()) + ONE_DAY;

      await expect(
        ccob.connect(alice).createOrder(
          ethers.ZeroAddress, // sellToken (native)
          ethers.parseEther("1"), // sellAmount
          ethers.ZeroAddress, // buyToken
          ethers.parseEther("0.1"), // buyAmount
          POLYGON_CHAIN_ID, // targetChainId
          alice.address, // targetAddress
          MIN_TIMELOCK, // minTimelock
          expiresAt
        )
      ).to.emit(ccob, "OrderCreated");

      const order = await ccob.getOrder(1);
      expect(order.id).to.equal(1);
      expect(order.creator).to.equal(alice.address);
      expect(order.sellAmount).to.equal(ethers.parseEther("1"));
      expect(order.buyAmount).to.equal(ethers.parseEther("0.1"));
      expect(order.targetChainId).to.equal(POLYGON_CHAIN_ID);
      expect(order.status).to.equal(0); // Active
    });

    it("should increment order ID for each order", async function () {
      const expiresAt = (await time.latest()) + ONE_DAY;

      await ccob.connect(alice).createOrder(
        ethers.ZeroAddress, ethers.parseEther("1"),
        ethers.ZeroAddress, ethers.parseEther("0.1"),
        POLYGON_CHAIN_ID, alice.address, MIN_TIMELOCK, expiresAt
      );

      await ccob.connect(bob).createOrder(
        ethers.ZeroAddress, ethers.parseEther("2"),
        ethers.ZeroAddress, ethers.parseEther("0.2"),
        POLYGON_CHAIN_ID, bob.address, MIN_TIMELOCK, expiresAt
      );

      expect(await ccob.nextOrderId()).to.equal(3);
      expect(await ccob.getTotalOrders()).to.equal(2);
    });

    it("should revert if expiry is in the past", async function () {
      const pastExpiry = (await time.latest()) - 1;

      await expect(
        ccob.connect(alice).createOrder(
          ethers.ZeroAddress, ethers.parseEther("1"),
          ethers.ZeroAddress, ethers.parseEther("0.1"),
          POLYGON_CHAIN_ID, alice.address, MIN_TIMELOCK, pastExpiry
        )
      ).to.be.revertedWithCustomError(ccob, "InvalidExpiry");
    });

    it("should revert if sell amount is zero", async function () {
      const expiresAt = (await time.latest()) + ONE_DAY;

      await expect(
        ccob.connect(alice).createOrder(
          ethers.ZeroAddress, 0,
          ethers.ZeroAddress, ethers.parseEther("0.1"),
          POLYGON_CHAIN_ID, alice.address, MIN_TIMELOCK, expiresAt
        )
      ).to.be.revertedWithCustomError(ccob, "InvalidAmounts");
    });

    it("should revert if buy amount is zero", async function () {
      const expiresAt = (await time.latest()) + ONE_DAY;

      await expect(
        ccob.connect(alice).createOrder(
          ethers.ZeroAddress, ethers.parseEther("1"),
          ethers.ZeroAddress, 0,
          POLYGON_CHAIN_ID, alice.address, MIN_TIMELOCK, expiresAt
        )
      ).to.be.revertedWithCustomError(ccob, "InvalidAmounts");
    });

    it("should revert if target chain is same as source", async function () {
      const expiresAt = (await time.latest()) + ONE_DAY;
      const currentChainId = await ccob.getChainId();

      await expect(
        ccob.connect(alice).createOrder(
          ethers.ZeroAddress, ethers.parseEther("1"),
          ethers.ZeroAddress, ethers.parseEther("0.1"),
          currentChainId, alice.address, MIN_TIMELOCK, expiresAt
        )
      ).to.be.revertedWithCustomError(ccob, "SameChainNotAllowed");
    });

    it("should revert if target chain is not supported", async function () {
      const expiresAt = (await time.latest()) + ONE_DAY;
      const unsupportedChain = 999999n;

      await expect(
        ccob.connect(alice).createOrder(
          ethers.ZeroAddress, ethers.parseEther("1"),
          ethers.ZeroAddress, ethers.parseEther("0.1"),
          unsupportedChain, alice.address, MIN_TIMELOCK, expiresAt
        )
      ).to.be.revertedWithCustomError(ccob, "UnsupportedChain");
    });

    it("should revert if timelock is less than 1 hour", async function () {
      const expiresAt = (await time.latest()) + ONE_DAY;
      const shortTimelock = 1800; // 30 minutes

      await expect(
        ccob.connect(alice).createOrder(
          ethers.ZeroAddress, ethers.parseEther("1"),
          ethers.ZeroAddress, ethers.parseEther("0.1"),
          POLYGON_CHAIN_ID, alice.address, shortTimelock, expiresAt
        )
      ).to.be.revertedWithCustomError(ccob, "InvalidTimelock");
    });
  });

  describe("Matching Orders", function () {
    let orderId;
    const htlcSwapId = ethers.keccak256(ethers.toUtf8Bytes("swap123"));

    beforeEach(async function () {
      const expiresAt = (await time.latest()) + ONE_DAY;
      await ccob.connect(alice).createOrder(
        ethers.ZeroAddress, ethers.parseEther("1"),
        ethers.ZeroAddress, ethers.parseEther("0.1"),
        POLYGON_CHAIN_ID, alice.address, MIN_TIMELOCK, expiresAt
      );
      orderId = 1;
    });

    it("should match an active order", async function () {
      await expect(ccob.connect(matcher).matchOrder(orderId, htlcSwapId))
        .to.emit(ccob, "OrderMatched")
        .withArgs(orderId, matcher.address, htlcSwapId);

      const order = await ccob.getOrder(orderId);
      expect(order.status).to.equal(1); // Matched
      expect(order.matchedBy).to.equal(matcher.address);
      expect(order.htlcSwapId).to.equal(htlcSwapId);
    });

    it("should revert if order is not active", async function () {
      await ccob.connect(alice).cancelOrder(orderId);

      await expect(
        ccob.connect(matcher).matchOrder(orderId, htlcSwapId)
      ).to.be.revertedWithCustomError(ccob, "OrderNotActive");
    });

    it("should revert when trying to match expired order", async function () {
      await time.increase(ONE_DAY + 1);

      // When trying to match an expired order, it reverts
      // Note: State changes in a reverting tx are NOT persisted
      await expect(
        ccob.connect(matcher).matchOrder(orderId, htlcSwapId)
      ).to.be.revertedWithCustomError(ccob, "OrderNotActive");

      // Order status remains Active (not changed to Expired) because tx reverted
      const order = await ccob.getOrder(orderId);
      expect(order.status).to.equal(0); // Still Active
    });
  });

  describe("Completing Orders", function () {
    let orderId;
    const htlcSwapId = ethers.keccak256(ethers.toUtf8Bytes("swap123"));

    beforeEach(async function () {
      const expiresAt = (await time.latest()) + ONE_DAY;
      await ccob.connect(alice).createOrder(
        ethers.ZeroAddress, ethers.parseEther("1"),
        ethers.ZeroAddress, ethers.parseEther("0.1"),
        POLYGON_CHAIN_ID, alice.address, MIN_TIMELOCK, expiresAt
      );
      orderId = 1;
      await ccob.connect(matcher).matchOrder(orderId, htlcSwapId);
    });

    it("should complete order by creator", async function () {
      await expect(ccob.connect(alice).completeOrder(orderId))
        .to.emit(ccob, "OrderCompleted")
        .withArgs(orderId);

      const order = await ccob.getOrder(orderId);
      expect(order.status).to.equal(2); // Completed
    });

    it("should complete order by matcher", async function () {
      await expect(ccob.connect(matcher).completeOrder(orderId))
        .to.emit(ccob, "OrderCompleted")
        .withArgs(orderId);
    });

    it("should revert if order is not matched", async function () {
      const expiresAt = (await time.latest()) + ONE_DAY;
      await ccob.connect(bob).createOrder(
        ethers.ZeroAddress, ethers.parseEther("1"),
        ethers.ZeroAddress, ethers.parseEther("0.1"),
        POLYGON_CHAIN_ID, bob.address, MIN_TIMELOCK, expiresAt
      );

      await expect(
        ccob.connect(bob).completeOrder(2)
      ).to.be.revertedWithCustomError(ccob, "OrderNotActive");
    });

    it("should revert if caller is not creator or matcher", async function () {
      await expect(
        ccob.connect(bob).completeOrder(orderId)
      ).to.be.revertedWithCustomError(ccob, "NotOrderCreator");
    });
  });

  describe("Canceling Orders", function () {
    let orderId;

    beforeEach(async function () {
      const expiresAt = (await time.latest()) + ONE_DAY;
      await ccob.connect(alice).createOrder(
        ethers.ZeroAddress, ethers.parseEther("1"),
        ethers.ZeroAddress, ethers.parseEther("0.1"),
        POLYGON_CHAIN_ID, alice.address, MIN_TIMELOCK, expiresAt
      );
      orderId = 1;
    });

    it("should cancel an active order", async function () {
      await expect(ccob.connect(alice).cancelOrder(orderId))
        .to.emit(ccob, "OrderCancelled")
        .withArgs(orderId);

      const order = await ccob.getOrder(orderId);
      expect(order.status).to.equal(3); // Cancelled
    });

    it("should revert if order is not active", async function () {
      await ccob.connect(alice).cancelOrder(orderId);

      await expect(
        ccob.connect(alice).cancelOrder(orderId)
      ).to.be.revertedWithCustomError(ccob, "OrderNotActive");
    });

    it("should revert if caller is not creator", async function () {
      await expect(
        ccob.connect(bob).cancelOrder(orderId)
      ).to.be.revertedWithCustomError(ccob, "NotOrderCreator");
    });
  });

  describe("Reactivating Orders", function () {
    let orderId;
    const htlcSwapId = ethers.keccak256(ethers.toUtf8Bytes("swap123"));

    beforeEach(async function () {
      const expiresAt = (await time.latest()) + ONE_DAY;
      await ccob.connect(alice).createOrder(
        ethers.ZeroAddress, ethers.parseEther("1"),
        ethers.ZeroAddress, ethers.parseEther("0.1"),
        POLYGON_CHAIN_ID, alice.address, MIN_TIMELOCK, expiresAt
      );
      orderId = 1;
      await ccob.connect(matcher).matchOrder(orderId, htlcSwapId);
    });

    it("should reactivate a matched order", async function () {
      await ccob.connect(alice).reactivateOrder(orderId);

      const order = await ccob.getOrder(orderId);
      expect(order.status).to.equal(0); // Active
      expect(order.matchedBy).to.equal(ethers.ZeroAddress);
      expect(order.htlcSwapId).to.equal(ethers.ZeroHash);
    });

    it("should revert if order is not matched", async function () {
      await ccob.connect(alice).reactivateOrder(orderId); // Now active

      await expect(
        ccob.connect(alice).reactivateOrder(orderId)
      ).to.be.revertedWithCustomError(ccob, "OrderNotActive");
    });

    it("should revert if caller is not creator", async function () {
      await expect(
        ccob.connect(bob).reactivateOrder(orderId)
      ).to.be.revertedWithCustomError(ccob, "NotOrderCreator");
    });

    it("should revert if reactivating after expiry", async function () {
      await time.increase(ONE_DAY + 1);

      // When trying to reactivate an expired matched order, it reverts
      // Note: State changes in a reverting tx are NOT persisted
      await expect(
        ccob.connect(alice).reactivateOrder(orderId)
      ).to.be.revertedWithCustomError(ccob, "InvalidExpiry");

      // Order status remains Matched (not changed to Expired) because tx reverted
      const order = await ccob.getOrder(orderId);
      expect(order.status).to.equal(1); // Still Matched
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      const expiresAt = (await time.latest()) + ONE_DAY;

      // Create multiple orders
      await ccob.connect(alice).createOrder(
        ethers.ZeroAddress, ethers.parseEther("1"),
        ethers.ZeroAddress, ethers.parseEther("0.1"),
        POLYGON_CHAIN_ID, alice.address, MIN_TIMELOCK, expiresAt
      );

      await ccob.connect(alice).createOrder(
        ethers.ZeroAddress, ethers.parseEther("2"),
        ethers.ZeroAddress, ethers.parseEther("0.2"),
        POLYGON_CHAIN_ID, alice.address, MIN_TIMELOCK, expiresAt
      );

      await ccob.connect(bob).createOrder(
        ethers.ZeroAddress, ethers.parseEther("3"),
        ethers.ZeroAddress, ethers.parseEther("0.3"),
        POLYGON_CHAIN_ID, bob.address, MIN_TIMELOCK, expiresAt
      );
    });

    it("should return orders by creator", async function () {
      const aliceOrders = await ccob.getOrdersByCreator(alice.address);
      expect(aliceOrders.length).to.equal(2);
      expect(aliceOrders[0].sellAmount).to.equal(ethers.parseEther("1"));
      expect(aliceOrders[1].sellAmount).to.equal(ethers.parseEther("2"));

      const bobOrders = await ccob.getOrdersByCreator(bob.address);
      expect(bobOrders.length).to.equal(1);
    });

    it("should return active orders for target chain", async function () {
      const orders = await ccob.getActiveOrdersForTargetChain(POLYGON_CHAIN_ID);
      expect(orders.length).to.equal(3);
    });

    it("should exclude cancelled orders from active orders", async function () {
      await ccob.connect(alice).cancelOrder(1);

      const orders = await ccob.getActiveOrdersForTargetChain(POLYGON_CHAIN_ID);
      expect(orders.length).to.equal(2);
    });

    it("should exclude expired orders from active orders", async function () {
      await time.increase(ONE_DAY + 1);

      const orders = await ccob.getActiveOrdersForTargetChain(POLYGON_CHAIN_ID);
      expect(orders.length).to.equal(0);
    });

    it("should return total orders count", async function () {
      expect(await ccob.getTotalOrders()).to.equal(3);
    });

    it("should return current chain ID", async function () {
      const chainId = await ccob.getChainId();
      expect(chainId).to.be.gt(0);
    });
  });
});
