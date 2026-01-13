const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenManager", function () {
  let tokenManager;
  let owner;
  let addr1;
  let addr2;
  let testToken;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy TokenManager
    const TokenManager = await ethers.getContractFactory("TokenManager");
    tokenManager = await TokenManager.deploy(owner.address);
    await tokenManager.waitForDeployment();

    // Deploy TestERC20 for testing
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    testToken = await TestERC20.deploy("Test Token", "TEST");
    await testToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await tokenManager.owner()).to.equal(owner.address);
    });

    it("Should revert if initialized with zero address", async function () {
      const TokenManager = await ethers.getContractFactory("TokenManager");
      await expect(
        TokenManager.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(tokenManager, "OwnableInvalidOwner");
    });
  });

  describe("Adding Tokens", function () {
    it("Should add a token to supported list", async function () {
      await expect(tokenManager.addToken(testToken.target))
        .to.emit(tokenManager, "TokenAdded");

      expect(await tokenManager.supportedTokens(testToken.target)).to.be.true;
      expect(await tokenManager.isTokenSupported(testToken.target)).to.be.true;
    });

    it("Should revert when adding zero address", async function () {
      await expect(
        tokenManager.addToken(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(tokenManager, "InvalidTokenAddress");
    });

    it("Should revert when adding already supported token", async function () {
      await tokenManager.addToken(testToken.target);
      await expect(
        tokenManager.addToken(testToken.target)
      ).to.be.revertedWithCustomError(tokenManager, "TokenAlreadySupported");
    });

    it("Should revert when non-owner tries to add token", async function () {
      await expect(
        tokenManager.connect(addr1).addToken(testToken.target)
      ).to.be.revertedWithCustomError(tokenManager, "OwnableUnauthorizedAccount");
    });
  });

  describe("Removing Tokens", function () {
    beforeEach(async function () {
      await tokenManager.addToken(testToken.target);
    });

    it("Should remove a token from supported list", async function () {
      await expect(tokenManager.removeToken(testToken.target))
        .to.emit(tokenManager, "TokenRemoved");

      expect(await tokenManager.supportedTokens(testToken.target)).to.be.false;
      expect(await tokenManager.isTokenSupported(testToken.target)).to.be.false;
    });

    it("Should revert when removing zero address", async function () {
      await expect(
        tokenManager.removeToken(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(tokenManager, "InvalidTokenAddress");
    });

    it("Should revert when removing non-supported token", async function () {
      await expect(
        tokenManager.removeToken(addr2.address)
      ).to.be.revertedWithCustomError(tokenManager, "TokenAlreadyNotSupported");
    });

    it("Should revert when non-owner tries to remove token", async function () {
      await expect(
        tokenManager.connect(addr1).removeToken(testToken.target)
      ).to.be.revertedWithCustomError(tokenManager, "OwnableUnauthorizedAccount");
    });
  });

  describe("Token Support Check", function () {
    it("Should return false for non-supported token", async function () {
      expect(await tokenManager.isTokenSupported(testToken.target)).to.be.false;
    });

    it("Should return true for supported token", async function () {
      await tokenManager.addToken(testToken.target);
      expect(await tokenManager.isTokenSupported(testToken.target)).to.be.true;
    });
  });
});
