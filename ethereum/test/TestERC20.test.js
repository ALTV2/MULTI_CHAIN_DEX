const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TestERC20", function () {
  let testToken;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const TestERC20 = await ethers.getContractFactory("TestERC20");
    testToken = await TestERC20.deploy("Test Token", "TEST");
    await testToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      expect(await testToken.name()).to.equal("Test Token");
      expect(await testToken.symbol()).to.equal("TEST");
    });

    it("Should set the right owner", async function () {
      expect(await testToken.owner()).to.equal(owner.address);
    });

    it("Should have zero initial supply", async function () {
      expect(await testToken.totalSupply()).to.equal(0);
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");

      await testToken.mint(addr1.address, mintAmount);

      expect(await testToken.balanceOf(addr1.address)).to.equal(mintAmount);
      expect(await testToken.totalSupply()).to.equal(mintAmount);
    });

    it("Should emit Transfer event on mint", async function () {
      const mintAmount = ethers.parseEther("100");

      await expect(testToken.mint(addr1.address, mintAmount))
        .to.emit(testToken, "Transfer")
        .withArgs(ethers.ZeroAddress, addr1.address, mintAmount);
    });

    it("Should fail if non-owner tries to mint", async function () {
      const mintAmount = ethers.parseEther("100");

      await expect(
        testToken.connect(addr1).mint(addr2.address, mintAmount)
      ).to.be.revertedWithCustomError(testToken, "OwnableUnauthorizedAccount");
    });

    it("Should fail if minting to zero address", async function () {
      const mintAmount = ethers.parseEther("100");

      await expect(
        testToken.mint(ethers.ZeroAddress, mintAmount)
      ).to.be.revertedWithCustomError(testToken, "InvalidRecipient");
    });

    it("Should allow multiple mints", async function () {
      const firstMint = ethers.parseEther("500");
      const secondMint = ethers.parseEther("300");

      await testToken.mint(addr1.address, firstMint);
      await testToken.mint(addr1.address, secondMint);

      expect(await testToken.balanceOf(addr1.address)).to.equal(
        firstMint + secondMint
      );
      expect(await testToken.totalSupply()).to.equal(firstMint + secondMint);
    });
  });

  describe("ERC20 Functionality", function () {
    beforeEach(async function () {
      await testToken.mint(owner.address, ethers.parseEther("10000"));
    });

    it("Should transfer tokens between accounts", async function () {
      const transferAmount = ethers.parseEther("50");

      await testToken.transfer(addr1.address, transferAmount);
      expect(await testToken.balanceOf(addr1.address)).to.equal(transferAmount);

      await testToken.connect(addr1).transfer(addr2.address, transferAmount);
      expect(await testToken.balanceOf(addr2.address)).to.equal(transferAmount);
      expect(await testToken.balanceOf(addr1.address)).to.equal(0);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const initialOwnerBalance = await testToken.balanceOf(owner.address);

      await expect(
        testToken.connect(addr1).transfer(owner.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(testToken, "ERC20InsufficientBalance");

      expect(await testToken.balanceOf(owner.address)).to.equal(
        initialOwnerBalance
      );
    });

    it("Should update balances after transfers", async function () {
      const initialOwnerBalance = await testToken.balanceOf(owner.address);
      const transferAmount = ethers.parseEther("100");

      await testToken.transfer(addr1.address, transferAmount);
      await testToken.transfer(addr2.address, transferAmount);

      const finalOwnerBalance = await testToken.balanceOf(owner.address);
      expect(finalOwnerBalance).to.equal(
        initialOwnerBalance - transferAmount - transferAmount
      );

      expect(await testToken.balanceOf(addr1.address)).to.equal(transferAmount);
      expect(await testToken.balanceOf(addr2.address)).to.equal(transferAmount);
    });

    it("Should approve and transferFrom tokens", async function () {
      const approveAmount = ethers.parseEther("100");

      await testToken.approve(addr1.address, approveAmount);
      expect(await testToken.allowance(owner.address, addr1.address)).to.equal(
        approveAmount
      );

      await testToken.connect(addr1).transferFrom(
        owner.address,
        addr2.address,
        approveAmount
      );

      expect(await testToken.balanceOf(addr2.address)).to.equal(approveAmount);
      expect(await testToken.allowance(owner.address, addr1.address)).to.equal(0);
    });
  });
});
