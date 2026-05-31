const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("HTLC", function () {
  let htlc;
  let token;
  let owner;
  let alice;
  let bob;

  const SECRET = ethers.encodeBytes32String("mysecret123");
  let HASHLOCK;

  // V-4: createSwap binds swapId to keccak256(abi.encode(initiator, participant, hashlock,
  // timelock, chainId)) — matches the off-chain frontend derivation.
  const coder = ethers.AbiCoder.defaultAbiCoder();
  async function deriveSwapId(initiator, participant, hashlock, timelock) {
    const { chainId } = await ethers.provider.getNetwork();
    return ethers.keccak256(coder.encode(
      ["address", "address", "bytes32", "uint256", "uint256"],
      [initiator, participant, hashlock, timelock, chainId]
    ));
  }

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    // Deploy HTLC
    const HTLC = await ethers.getContractFactory("contracts/htlc/HTLC.sol:HTLC");
    htlc = await HTLC.deploy();
    await htlc.waitForDeployment();

    // Deploy test token
    const TestERC20 = await ethers.getContractFactory("contracts/tokens/TestERC20.sol:TestERC20");
    token = await TestERC20.deploy("Test Token", "TST", 18);
    await token.waitForDeployment();

    // Mint tokens to alice
    await token.mint(alice.address, ethers.parseEther("1000"));

    // Calculate hashlock
    HASHLOCK = ethers.keccak256(ethers.solidityPacked(["bytes32"], [SECRET]));
  });

  describe("createSwap", function () {
    it("should create a native token swap", async function () {
      const timelock = (await time.latest()) + 3600; // 1 hour from now
      const swapId = await deriveSwapId(alice.address, bob.address, HASHLOCK, timelock);
      const amount = ethers.parseEther("1");

      await expect(
        htlc.connect(alice).createSwap(
          swapId,
          bob.address,
          HASHLOCK,
          timelock,
          ethers.ZeroAddress,
          0,
          { value: amount }
        )
      )
        .to.emit(htlc, "SwapCreated")
        .withArgs(swapId, alice.address, bob.address, ethers.ZeroAddress, amount, HASHLOCK, timelock);

      const swap = await htlc.getSwap(swapId);
      expect(swap.initiator).to.equal(alice.address);
      expect(swap.participant).to.equal(bob.address);
      expect(swap.amount).to.equal(amount);
      expect(swap.hashlock).to.equal(HASHLOCK);
      expect(swap.status).to.equal(1); // Active
    });

    it("should create an ERC20 token swap", async function () {
      const timelock = (await time.latest()) + 3600;
      const swapId = await deriveSwapId(alice.address, bob.address, HASHLOCK, timelock);
      const amount = ethers.parseEther("100");

      // Approve tokens
      await token.connect(alice).approve(await htlc.getAddress(), amount);

      await expect(
        htlc.connect(alice).createSwap(
          swapId,
          bob.address,
          HASHLOCK,
          timelock,
          await token.getAddress(),
          amount
        )
      ).to.emit(htlc, "SwapCreated");

      const swap = await htlc.getSwap(swapId);
      expect(swap.token).to.equal(await token.getAddress());
      expect(swap.amount).to.equal(amount);
    });

    it("should revert if swap already exists", async function () {
      const timelock = (await time.latest()) + 3600;
      const swapId = await deriveSwapId(alice.address, bob.address, HASHLOCK, timelock);

      await htlc.connect(alice).createSwap(
        swapId,
        bob.address,
        HASHLOCK,
        timelock,
        ethers.ZeroAddress,
        0,
        { value: ethers.parseEther("1") }
      );

      await expect(
        htlc.connect(alice).createSwap(
          swapId,
          bob.address,
          HASHLOCK,
          timelock,
          ethers.ZeroAddress,
          0,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWithCustomError(htlc, "SwapAlreadyExists");
    });

    it("V-4: reverts when the swapId is not bound to its parameters", async function () {
      const timelock = (await time.latest()) + 3600;
      const bogusSwapId = ethers.encodeBytes32String("attacker-chosen");

      await expect(
        htlc.connect(alice).createSwap(
          bogusSwapId,
          bob.address,
          HASHLOCK,
          timelock,
          ethers.ZeroAddress,
          0,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWithCustomError(htlc, "InvalidSwapId");
    });
  });

  describe("withdraw", function () {
    let swapId;
    let timelock;
    const amount = ethers.parseEther("1");

    beforeEach(async function () {
      timelock = (await time.latest()) + 3600;
      swapId = await deriveSwapId(alice.address, bob.address, HASHLOCK, timelock);

      await htlc.connect(alice).createSwap(
        swapId,
        bob.address,
        HASHLOCK,
        timelock,
        ethers.ZeroAddress,
        0,
        { value: amount }
      );
    });

    it("should allow withdrawal with correct secret", async function () {
      const bobBalanceBefore = await ethers.provider.getBalance(bob.address);

      await expect(htlc.connect(bob).withdraw(swapId, SECRET))
        .to.emit(htlc, "SwapWithdrawn")
        .withArgs(swapId, SECRET, bob.address);

      const bobBalanceAfter = await ethers.provider.getBalance(bob.address);
      expect(bobBalanceAfter).to.be.gt(bobBalanceBefore);

      const swap = await htlc.getSwap(swapId);
      expect(swap.status).to.equal(2); // Withdrawn
    });

    it("should revert with incorrect secret", async function () {
      const wrongSecret = ethers.encodeBytes32String("wrongsecret");

      await expect(htlc.connect(bob).withdraw(swapId, wrongSecret))
        .to.be.revertedWithCustomError(htlc, "InvalidHashlock");
    });

    it("should revert if timelock expired", async function () {
      await time.increase(3601);

      await expect(htlc.connect(bob).withdraw(swapId, SECRET))
        .to.be.revertedWithCustomError(htlc, "TimelockExpired");
    });
  });

  describe("refund", function () {
    let swapId;
    let timelock;
    const amount = ethers.parseEther("1");

    beforeEach(async function () {
      timelock = (await time.latest()) + 3600;
      swapId = await deriveSwapId(alice.address, bob.address, HASHLOCK, timelock);

      await htlc.connect(alice).createSwap(
        swapId,
        bob.address,
        HASHLOCK,
        timelock,
        ethers.ZeroAddress,
        0,
        { value: amount }
      );
    });

    it("should allow refund after timelock expires", async function () {
      await time.increase(3601);

      const aliceBalanceBefore = await ethers.provider.getBalance(alice.address);

      await expect(htlc.connect(alice).refund(swapId))
        .to.emit(htlc, "SwapRefunded")
        .withArgs(swapId, alice.address);

      const aliceBalanceAfter = await ethers.provider.getBalance(alice.address);
      expect(aliceBalanceAfter).to.be.gt(aliceBalanceBefore);

      const swap = await htlc.getSwap(swapId);
      expect(swap.status).to.equal(3); // Refunded
    });

    it("should revert if timelock not expired", async function () {
      await expect(htlc.connect(alice).refund(swapId))
        .to.be.revertedWithCustomError(htlc, "TimelockNotExpired");
    });
  });

  describe("view functions", function () {
    it("should generate correct hashlock", async function () {
      const hashlock = await htlc.getHashlock(SECRET);
      expect(hashlock).to.equal(HASHLOCK);
    });

    it("generateSwapId matches the off-chain abi.encode keccak256 formula", async function () {
      const timelock = (await time.latest()) + 3600;
      const onChain = await htlc.generateSwapId(alice.address, bob.address, HASHLOCK, timelock);
      expect(onChain).to.equal(await deriveSwapId(alice.address, bob.address, HASHLOCK, timelock));
    });

    it("should track swaps by user", async function () {
      const timelock = (await time.latest()) + 3600;
      const swapId = await deriveSwapId(alice.address, bob.address, HASHLOCK, timelock);

      await htlc.connect(alice).createSwap(
        swapId,
        bob.address,
        HASHLOCK,
        timelock,
        ethers.ZeroAddress,
        0,
        { value: ethers.parseEther("1") }
      );

      const aliceSwaps = await htlc.getSwapsAsInitiator(alice.address);
      expect(aliceSwaps).to.include(swapId);

      const bobSwaps = await htlc.getSwapsAsParticipant(bob.address);
      expect(bobSwaps).to.include(swapId);
    });
  });
});
