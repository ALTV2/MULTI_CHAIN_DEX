const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * V-3: fee-on-transfer / shared-pool drain.
 *
 * HTLC holds one shared balance per token. createSwap records the *requested*
 * _amount instead of the actually-received delta, so a fee-on-transfer token
 * under-funds the pool and the shortfall is socialized across OTHER swaps of the
 * same token: the first claimant is over-paid from someone else's deposit and the
 * last claimant's refund reverts (funds stuck).
 *
 * RED (buggy code): bob's refund reverts and alice is paid 100 though she deposited 90.
 * GREEN (delta fix): each swap is self-funded (records 90); both refunds succeed and
 * each party gets back exactly what they deposited.
 */
describe("HTLC fee-on-transfer pool accounting (V-3)", function () {
  let htlc, fee, alice, bob, carol;
  const REQUESTED = ethers.parseEther("100"); // each requests 100
  const RECEIVED = ethers.parseEther("90"); // contract actually receives 90 (10% fee)

  beforeEach(async function () {
    [, alice, bob, carol] = await ethers.getSigners();
    const HTLC = await ethers.getContractFactory("contracts/htlc/HTLC.sol:HTLC");
    htlc = await HTLC.deploy();
    await htlc.waitForDeployment();
    const Fee = await ethers.getContractFactory("contracts/test/FeeOnTransferToken.sol:FeeOnTransferToken");
    fee = await Fee.deploy();
    await fee.waitForDeployment();
    await fee.mint(alice.address, REQUESTED);
    await fee.mint(bob.address, REQUESTED);
  });

  const coder = ethers.AbiCoder.defaultAbiCoder();
  async function createSwap(signer, tag) {
    const tl = (await time.latest()) + 3600;
    const hashlock = ethers.keccak256(ethers.toUtf8Bytes("h" + tag));
    // V-4: swapId must be the canonical keccak256(abi.encode(initiator, participant, hashlock, timelock, chainId)).
    const { chainId } = await ethers.provider.getNetwork();
    const swapId = ethers.keccak256(coder.encode(
      ["address", "address", "bytes32", "uint256", "uint256"],
      [signer.address, carol.address, hashlock, tl, chainId]
    ));
    await fee.connect(signer).approve(await htlc.getAddress(), REQUESTED);
    await htlc.connect(signer).createSwap(swapId, carol.address, hashlock, tl, await fee.getAddress(), REQUESTED);
    return swapId;
  }

  it("does not let one swap drain another's funds; each refund returns the deposited amount", async function () {
    const idA = await createSwap(alice, "A");
    const idB = await createSwap(bob, "B");

    // each swap was funded with 90 (after 10% fee), so the swap.amount must equal 90, not 100
    expect((await htlc.getSwap(idA)).amount).to.equal(RECEIVED);
    expect((await htlc.getSwap(idB)).amount).to.equal(RECEIVED);

    await time.increase(3601);

    const aliceBefore = await fee.balanceOf(alice.address);
    await htlc.connect(alice).refund(idA);
    expect((await fee.balanceOf(alice.address)) - aliceBefore).to.equal(RECEIVED * 9n / 10n); // 90 minus the 10% fee on the way OUT = 81

    // bob must still be able to recover — the pool must not have been drained by alice
    await expect(htlc.connect(bob).refund(idB)).to.not.be.reverted;
  });
});
