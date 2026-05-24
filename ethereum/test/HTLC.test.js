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

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    // Deploy HTLC
    const HTLC = await ethers.getContractFactory("contracts/htlc/HTLC.sol:HTLC");
    htlc = await HTLC.deploy();
    await htlc.waitForDeployment();

    // Deploy test token (Ethereum TestERC20 takes 2 args: name, symbol)
    const TestERC20 = await ethers.getContractFactory("contracts/TestERC20.sol:TestERC20");
    token = await TestERC20.deploy("Test Token", "TST");
    await token.waitForDeployment();

    // Mint tokens to alice
    await token.mint(alice.address, ethers.parseEther("1000"));

    // Calculate hashlock
    HASHLOCK = ethers.keccak256(ethers.solidityPacked(["bytes32"], [SECRET]));
  });

  describe("createSwap", function () {
    it("should create a native token swap", async function () {
      const swapId = ethers.encodeBytes32String("swap1");
      const timelock = (await time.latest()) + 3600; // 1 hour from now
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
      const swapId = ethers.encodeBytes32String("swap2");
      const timelock = (await time.latest()) + 3600;
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
      const swapId = ethers.encodeBytes32String("swap3");
      const timelock = (await time.latest()) + 3600;

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
  });

  describe("withdraw", function () {
    let swapId;
    let timelock;
    const amount = ethers.parseEther("1");

    beforeEach(async function () {
      swapId = ethers.encodeBytes32String("swap4");
      timelock = (await time.latest()) + 3600;

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

    it("should revert on double withdrawal", async function () {
      await htlc.connect(bob).withdraw(swapId, SECRET);

      // A second withdrawal of an already-withdrawn swap is rejected
      await expect(htlc.connect(bob).withdraw(swapId, SECRET))
        .to.be.revertedWithCustomError(htlc, "SwapNotActive");
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
      swapId = ethers.encodeBytes32String("swap5");
      timelock = (await time.latest()) + 3600;

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

    it("should track swaps by user", async function () {
      const swapId = ethers.encodeBytes32String("swap6");
      const timelock = (await time.latest()) + 3600;

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

    it("isSwapActive reflects swap state", async function () {
      const swapId = ethers.encodeBytes32String("swapActive");
      const timelock = (await time.latest()) + 3600;
      expect(await htlc.isSwapActive(swapId)).to.equal(false); // not created yet
      await htlc.connect(alice).createSwap(
        swapId, bob.address, HASHLOCK, timelock, ethers.ZeroAddress, 0, { value: ethers.parseEther("1") }
      );
      expect(await htlc.isSwapActive(swapId)).to.equal(true);
      await htlc.connect(bob).withdraw(swapId, SECRET);
      expect(await htlc.isSwapActive(swapId)).to.equal(false); // withdrawn
    });

    it("generateSwapId matches the off-chain keccak256 formula", async function () {
      const timelock = (await time.latest()) + 3600;
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const onChain = await htlc.generateSwapId(alice.address, bob.address, HASHLOCK, timelock);
      const expected = ethers.keccak256(ethers.solidityPacked(
        ["address", "address", "bytes32", "uint256", "uint256"],
        [alice.address, bob.address, HASHLOCK, timelock, chainId]
      ));
      expect(onChain).to.equal(expected);
    });
  });

  describe("ERC20 withdraw / refund paths", function () {
    let swapId, timelock;
    const amount = ethers.parseEther("100");

    beforeEach(async function () {
      timelock = (await time.latest()) + 3600;
      await token.connect(alice).approve(await htlc.getAddress(), amount);
    });

    it("withdraws ERC20 tokens to the participant", async function () {
      swapId = ethers.encodeBytes32String("erc20w");
      await htlc.connect(alice).createSwap(swapId, bob.address, HASHLOCK, timelock, await token.getAddress(), amount);
      await expect(htlc.connect(bob).withdraw(swapId, SECRET)).to.emit(htlc, "SwapWithdrawn");
      expect(await token.balanceOf(bob.address)).to.equal(amount);
    });

    it("refunds ERC20 tokens to the initiator after timelock", async function () {
      swapId = ethers.encodeBytes32String("erc20r");
      await htlc.connect(alice).createSwap(swapId, bob.address, HASHLOCK, timelock, await token.getAddress(), amount);
      await time.increase(3601);
      await expect(htlc.connect(alice).refund(swapId)).to.emit(htlc, "SwapRefunded");
      expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("1000"));
    });
  });

  describe("createSwap validation branches", function () {
    let timelock;
    beforeEach(async function () { timelock = (await time.latest()) + 3600; });

    it("reverts on zero participant", async function () {
      await expect(htlc.connect(alice).createSwap(
        ethers.encodeBytes32String("p0"), ethers.ZeroAddress, HASHLOCK, timelock, ethers.ZeroAddress, 0, { value: 1n }
      )).to.be.revertedWithCustomError(htlc, "InvalidParticipant");
    });
    it("reverts on past timelock", async function () {
      await expect(htlc.connect(alice).createSwap(
        ethers.encodeBytes32String("t0"), bob.address, HASHLOCK, 1, ethers.ZeroAddress, 0, { value: 1n }
      )).to.be.revertedWithCustomError(htlc, "InvalidTimelock");
    });
    it("reverts on zero hashlock", async function () {
      await expect(htlc.connect(alice).createSwap(
        ethers.encodeBytes32String("h0"), bob.address, ethers.ZeroHash, timelock, ethers.ZeroAddress, 0, { value: 1n }
      )).to.be.revertedWithCustomError(htlc, "InvalidHashlock");
    });
    it("reverts on zero native value", async function () {
      await expect(htlc.connect(alice).createSwap(
        ethers.encodeBytes32String("n0"), bob.address, HASHLOCK, timelock, ethers.ZeroAddress, 0, { value: 0n }
      )).to.be.revertedWithCustomError(htlc, "InvalidAmount");
    });
    it("reverts on zero ERC20 amount", async function () {
      await expect(htlc.connect(alice).createSwap(
        ethers.encodeBytes32String("e0"), bob.address, HASHLOCK, timelock, await token.getAddress(), 0
      )).to.be.revertedWithCustomError(htlc, "InvalidAmount");
    });
    it("reverts when ETH is sent with an ERC20 swap", async function () {
      await token.connect(alice).approve(await htlc.getAddress(), ethers.parseEther("100"));
      await expect(htlc.connect(alice).createSwap(
        ethers.encodeBytes32String("ee"), bob.address, HASHLOCK, timelock, await token.getAddress(), ethers.parseEther("100"), { value: 1n }
      )).to.be.revertedWithCustomError(htlc, "InvalidAmount");
    });
  });

  describe("withdraw / refund on a non-existent swap", function () {
    it("withdraw reverts SwapNotActive", async function () {
      await expect(htlc.connect(bob).withdraw(ethers.encodeBytes32String("ghost"), SECRET))
        .to.be.revertedWithCustomError(htlc, "SwapNotActive");
    });
    it("refund reverts SwapNotActive", async function () {
      await expect(htlc.connect(alice).refund(ethers.encodeBytes32String("ghost2")))
        .to.be.revertedWithCustomError(htlc, "SwapNotActive");
    });
  });
});
