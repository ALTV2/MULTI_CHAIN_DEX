const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * V-3 (class): OrderBook escrows every order's sell token in ONE shared contract balance.
 * Recording the *requested* amount while a fee-on-transfer token deposits less lets an early
 * cancel/move over-draw the pool and brick the last order's cancel. The fix records the actual
 * received balance delta. This mirrors the HTLC V-3 fix for the same-chain order book.
 */
describe("OrderBook — fee-on-transfer pool drain (V-3 class)", function () {
  let orderBook, tokenManager, feeToken, owner, alice, bob;
  const SELL = ethers.parseEther("100");
  const FEE_BPS = 1000n; // 10% — matches FeeOnTransferToken
  const RECEIVED = SELL - (SELL * FEE_BPS) / 10000n; // 90
  const BUY = ethers.parseEther("1");

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const TokenManager = await ethers.getContractFactory("TokenManager");
    tokenManager = await TokenManager.deploy(owner.address);
    await tokenManager.waitForDeployment();

    const OrderBook = await ethers.getContractFactory("OrderBook");
    orderBook = await OrderBook.deploy(tokenManager.target);
    await orderBook.waitForDeployment();

    const Fee = await ethers.getContractFactory("FeeOnTransferToken");
    feeToken = await Fee.deploy();
    await feeToken.waitForDeployment();

    await feeToken.mint(alice.address, SELL);
    await feeToken.mint(bob.address, SELL);
    await feeToken.connect(alice).approve(orderBook.target, SELL);
    await feeToken.connect(bob).approve(orderBook.target, SELL);
  });

  it("records the actual received amount, not the requested amount", async function () {
    // sell fee-token, buy ETH (only the sell side is escrowed at creation)
    await orderBook.connect(alice).createOrder(feeToken.target, ethers.ZeroAddress, SELL, BUY);
    const order = await orderBook.getOrder(1);
    expect(order.sellAmount).to.equal(RECEIVED); // 90, not the requested 100
  });

  it("an early cancel cannot drain another order's deposit", async function () {
    await orderBook.connect(alice).createOrder(feeToken.target, ethers.ZeroAddress, SELL, BUY);
    await orderBook.connect(bob).createOrder(feeToken.target, ethers.ZeroAddress, SELL, BUY);

    // Pool holds exactly what arrived: 2 * 90 = 180 (not the recorded-as-200 of the buggy version).
    expect(await feeToken.balanceOf(orderBook.target)).to.equal(2n * RECEIVED);

    // Alice cancels first; with the buggy code she would withdraw 100 and leave bob short.
    await expect(orderBook.connect(alice).cancelOrder(1)).to.not.be.reverted;
    // The load-bearing assertion: bob's deposit is still fully refundable.
    await expect(orderBook.connect(bob).cancelOrder(2)).to.not.be.reverted;
  });
});
