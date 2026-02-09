const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenManager", function () {
  let tokenManager;
  let owner;
  let addr1;
  let addr2;
  let tokenAddress;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    tokenAddress = addr1.address; // Use as a dummy token address

    const TokenManager = await ethers.getContractFactory("contracts/core/TokenManager.sol:TokenManager");
    tokenManager = await TokenManager.deploy(owner.address);
    await tokenManager.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      expect(await tokenManager.owner()).to.equal(owner.address);
    });

    it("should revert if initialOwner is zero address", async function () {
      const TokenManager = await ethers.getContractFactory("contracts/core/TokenManager.sol:TokenManager");
      await expect(
        TokenManager.deploy(ethers.ZeroAddress)
      ).to.be.reverted;
    });
  });

  describe("addToken", function () {
    it("should add a token successfully", async function () {
      await expect(tokenManager.addToken(tokenAddress))
        .to.emit(tokenManager, "TokenAdded");

      expect(await tokenManager.isTokenSupported(tokenAddress)).to.be.true;
    });

    it("should revert if token is zero address", async function () {
      await expect(
        tokenManager.addToken(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(tokenManager, "InvalidTokenAddress");
    });

    it("should revert if token already supported", async function () {
      await tokenManager.addToken(tokenAddress);
      await expect(
        tokenManager.addToken(tokenAddress)
      ).to.be.revertedWithCustomError(tokenManager, "TokenAlreadySupported");
    });

    it("should revert if called by non-owner", async function () {
      await expect(
        tokenManager.connect(addr1).addToken(addr2.address)
      ).to.be.revertedWithCustomError(tokenManager, "OwnableUnauthorizedAccount");
    });
  });

  describe("removeToken", function () {
    beforeEach(async function () {
      await tokenManager.addToken(tokenAddress);
    });

    it("should remove a token successfully", async function () {
      await expect(tokenManager.removeToken(tokenAddress))
        .to.emit(tokenManager, "TokenRemoved");

      expect(await tokenManager.isTokenSupported(tokenAddress)).to.be.false;
    });

    it("should revert if token is zero address", async function () {
      await expect(
        tokenManager.removeToken(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(tokenManager, "InvalidTokenAddress");
    });

    it("should revert if token not supported", async function () {
      await expect(
        tokenManager.removeToken(addr2.address)
      ).to.be.revertedWithCustomError(tokenManager, "TokenAlreadyNotSupported");
    });

    it("should revert if called by non-owner", async function () {
      await expect(
        tokenManager.connect(addr1).removeToken(tokenAddress)
      ).to.be.revertedWithCustomError(tokenManager, "OwnableUnauthorizedAccount");
    });
  });

  describe("isTokenSupported", function () {
    it("should return false for unsupported token", async function () {
      expect(await tokenManager.isTokenSupported(tokenAddress)).to.be.false;
    });

    it("should return true for supported token", async function () {
      await tokenManager.addToken(tokenAddress);
      expect(await tokenManager.isTokenSupported(tokenAddress)).to.be.true;
    });

    it("should return false after token removal", async function () {
      await tokenManager.addToken(tokenAddress);
      await tokenManager.removeToken(tokenAddress);
      expect(await tokenManager.isTokenSupported(tokenAddress)).to.be.false;
    });
  });
});
