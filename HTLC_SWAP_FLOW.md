# HTLC Cross-Chain Atomic Swap Flow

## Overview

This document describes in detail how a trustless cross-chain swap works in our DEX
using Hash Time-Locked Contracts (HTLC) and the CrossChainOrderBook (CCOB).

## Contracts

| Contract            | Ethereum Sepolia                           | Polygon Amoy                               |
|---------------------|--------------------------------------------|--------------------------------------------|
| HTLC                | 0x9aB954f470cc7196C0803bE44b1d58e762a48964 | 0x3d857Fc3510246A050817C29ea7C434ab7EbA81A |
| CrossChainOrderBook | 0x6A78740f7D35818D30e23ebD5A5880A1836aa445 | 0x5F08Ec67A95C4394d577c90c65083AEb119BD922 |

## Key Concept: How HTLC Makes Trustless Swaps Possible

The HTLC uses a **secret** (a random 32-byte value) and its **hashlock** (keccak256 of the secret).
- Whoever knows the secret can withdraw funds from an HTLC before the timelock expires.
- Once someone reveals the secret on one chain (by calling withdraw), it becomes publicly
  visible in the `SwapWithdrawn` event. The other party can then use this secret on the other chain.
- If nobody reveals the secret, both HTLCs expire and both parties refund.

## Actors

- **Alice** (Order Creator / Initiator) — generates the secret, creates the order on the source chain
- **Bob** (Matcher / Responder) — finds and matches Alice's order

## Concrete Example

Alice wants to sell **100 TKA** on Ethereum Sepolia for **0.005 MATIC** on Polygon Amoy.

---

## Phase 1: Order Creation (CCOB only, no tokens locked)

**Actor: Alice**
**Chain: Ethereum Sepolia**

1. Alice connects wallet to Sepolia
2. Alice calls `CrossChainOrderBook.createOrder()` on Sepolia:
   - sellToken: `0x16eb4f1a13dC130074360a14ec5ee01632e87584` (TKA on Sepolia)
   - sellAmount: `100000000000000000000` (100 * 10^18)
   - buyToken: `0x0000000000000000000000000000000000000000` (native MATIC)
   - buyAmount: `5000000000000000` (0.005 * 10^18)
   - targetChainId: `80002` (Polygon Amoy)
   - targetAddress: Alice's address on Polygon
   - minTimelock: `3600` (1 hour minimum)
   - expiresAt: `current_timestamp + 172800` (48 hours from now)

**Result:** Order #N created on Sepolia CCOB, status = Active.
**No tokens are locked at this stage.** This is just an advertisement of intent.

---

## Phase 2: Order Discovery

**Actor: Bob**
**Chain: Polygon Amoy (reading from Sepolia)**

3. Bob connects wallet to Polygon Amoy
4. Bob's frontend calls `getActiveOrdersForTargetChain(80002)` on Sepolia's CCOB
   (cross-chain read via RPC, using `chainId: sourceChainId` in wagmi's useReadContract)
5. Bob sees Alice's order: "100 TKA on Sepolia → 0.005 MATIC on Polygon"
6. Bob decides he wants to fill this order

---

## Phase 3: HTLC Setup — Initiator Side (Alice)

**Actor: Alice**
**Chain: Ethereum Sepolia**

7. Alice generates a random 32-byte **SECRET**:
   ```
   SECRET = 0xa1b2c3d4...  (random 32 bytes)
   ```

8. Alice computes the **HASHLOCK**:
   ```
   HASHLOCK = keccak256(abi.encodePacked(SECRET))
            = 0x7f8e9d...
   ```

9. Alice saves SECRET securely (localStorage, backend, etc.) — she will need it in Phase 5

10. Alice calls `HTLC.createSwap()` on **Sepolia**:
    - swapId: `keccak256(alice, bob, HASHLOCK, timelock, 11155111)` (deterministic)
    - participant: Bob's address
    - hashlock: HASHLOCK
    - timelock: `current_timestamp + 172800` (48 hours — LONG timelock)
    - token: TKA address on Sepolia
    - amount: 100 TKA

    **Alice must first approve TKA spending:** `TKA.approve(HTLC_address, 100e18)`

**Result:** 100 TKA locked in Sepolia HTLC. Alice is the initiator, Bob is the participant.
Event emitted: `SwapCreated(swapId, alice, bob, TKA, 100e18, HASHLOCK, timelock)`

11. Alice calls `CCOB.matchOrder(orderId, swapId)` on Sepolia (or Bob does it)
    to link the order with the HTLC swap.

---

## Phase 4: HTLC Response — Matcher Side (Bob)

**Actor: Bob**
**Chain: Polygon Amoy (after verifying on Sepolia)**

12. Bob reads Alice's HTLC on Sepolia to verify:
    ```
    htlc.getSwap(swapId) on Sepolia returns:
    - initiator: Alice ✓
    - participant: Bob ✓
    - token: TKA ✓
    - amount: 100e18 ✓
    - hashlock: HASHLOCK (Bob remembers this value)
    - timelock: ~48h from now ✓
    - status: Active ✓
    ```

13. Bob switches to Polygon Amoy

14. Bob calls `HTLC.createSwap()` on **Polygon Amoy**:
    - swapId: `keccak256(bob, alice, HASHLOCK, timelock, 80002)` (different from Alice's!)
    - participant: Alice's address (from order.targetAddress)
    - hashlock: **SAME HASHLOCK** as Alice's HTLC (this is critical!)
    - timelock: `current_timestamp + 86400` (24 hours — SHORT timelock, MUST be < Alice's)
    - token: `address(0)` (native MATIC)
    - amount: 0.005 MATIC (sent as msg.value)

**Result:** 0.005 MATIC locked in Polygon HTLC. Bob is the initiator, Alice is the participant.

### Why Bob's timelock MUST be shorter than Alice's:

```
Timeline:
|-------- Bob's HTLC (24h) --------|
|---------------- Alice's HTLC (48h) ----------------|
                                    ^                  ^
                               Bob can refund     Alice can refund

Alice must reveal SECRET before Bob's 24h timelock expires.
After Alice reveals, Bob has (48h - current_time) to use SECRET on Alice's HTLC.
```

---

## Phase 5: Secret Reveal & Withdrawal (Alice claims on Polygon)

**Actor: Alice**
**Chain: Polygon Amoy**

15. Alice reads Bob's HTLC on Polygon and verifies:
    ```
    htlc.getSwap(bobSwapId) on Polygon returns:
    - initiator: Bob ✓
    - participant: Alice ✓
    - amount: 0.005 MATIC ✓ (matches order.buyAmount)
    - hashlock: SAME as Alice's HTLC ✓
    - timelock: ~24h ✓ (shorter than Alice's 48h)
    - status: Active ✓
    ```

16. Alice switches to Polygon

17. Alice calls `HTLC.withdraw(bobSwapId, SECRET)` on **Polygon**:
    - The contract verifies `keccak256(SECRET) == HASHLOCK`
    - 0.005 MATIC sent to Alice (the participant)
    - **SECRET is now publicly visible** in the `SwapWithdrawn` event!

**Result:** Alice receives 0.005 MATIC on Polygon.
Event emitted: `SwapWithdrawn(bobSwapId, SECRET, alice)`

---

## Phase 6: Counter-Withdrawal (Bob claims on Sepolia)

**Actor: Bob**
**Chain: Ethereum Sepolia**

18. Bob's frontend watches for `SwapWithdrawn` events on Polygon's HTLC
    OR Bob reads the event logs from the transaction

19. Bob extracts SECRET from the event:
    ```
    event SwapWithdrawn(swapId, secret, participant)
    → secret = 0xa1b2c3d4...
    ```

20. Bob switches to Sepolia

21. Bob calls `HTLC.withdraw(aliceSwapId, SECRET)` on **Sepolia**:
    - The contract verifies `keccak256(SECRET) == HASHLOCK`
    - 100 TKA sent to Bob (the participant)

**Result:** Bob receives 100 TKA on Sepolia.

---

## Phase 7: Completion

22. Either Alice or Bob calls `CCOB.completeOrder(orderId)` on Sepolia
    to mark the order as Completed.

---

## Summary of All Transactions

| Step | Actor | Chain          | Contract | Function    | Effect                        |
|------|-------|----------------|----------|-------------|-------------------------------|
| 1    | Alice | Sepolia        | CCOB     | createOrder | Create order (no tokens)      |
| 2    | Alice | Sepolia        | TKA      | approve     | Allow HTLC to spend TKA       |
| 3    | Alice | Sepolia        | HTLC     | createSwap  | Lock 100 TKA (48h timelock)   |
| 4    | Alice | Sepolia        | CCOB     | matchOrder  | Link order to HTLC swapId     |
| 5    | Bob   | Polygon        | HTLC     | createSwap  | Lock 0.005 MATIC (24h)        |
| 6    | Alice | Polygon        | HTLC     | withdraw    | Claim MATIC, reveal SECRET    |
| 7    | Bob   | Sepolia        | HTLC     | withdraw    | Claim TKA using SECRET        |
| 8    | Any   | Sepolia        | CCOB     | completeOrder | Mark order completed        |

Total: 8 on-chain transactions (4 Alice, 3 Bob, 1 either)

---

## Failure Scenarios & Safety

### Scenario A: Alice never creates HTLC (after step 1)
- No tokens are locked anywhere
- Order remains Active on CCOB
- Alice or anyone can cancel the order

### Scenario B: Alice creates HTLC but Bob never responds (after step 3)
- Alice's 100 TKA locked in Sepolia HTLC
- After 48h, Alice calls `HTLC.refund(swapId)` on Sepolia → gets 100 TKA back
- Order can be reactivated or cancelled on CCOB

### Scenario C: Both create HTLCs but Alice never reveals secret
- Alice's 100 TKA locked (48h timelock)
- Bob's 0.005 MATIC locked (24h timelock)
- After 24h: Bob refunds on Polygon → gets 0.005 MATIC back
- After 48h: Alice refunds on Sepolia → gets 100 TKA back
- Nobody loses anything

### Scenario D: Alice reveals secret but Bob doesn't act
- Alice withdraws on Polygon → gets 0.005 MATIC
- Secret is now public
- If Bob doesn't use it before 48h → Alice's HTLC expires, Alice refunds 100 TKA
- This would mean Alice gets BOTH assets — but anyone can call withdraw with the
  revealed secret, so Bob (or anyone watching) will claim before expiry

### Scenario E: Griefing — someone matches but never creates HTLC
- Order is marked "Matched" on CCOB
- Alice can call `CCOB.reactivateOrder(orderId)` to return it to Active

---

## Current Implementation Status

### What EXISTS and WORKS:
1. HTLC contracts deployed on both chains ✅
2. CrossChainOrderBook contracts deployed on both chains ✅
3. Frontend: Create order on CCOB ✅
4. Frontend: View orders from other chains ✅
5. Frontend: Match order button (updates CCOB status only) ✅

### What is MISSING:
1. **Alice: Create HTLC after order creation** — No UI for generating SECRET,
   approving tokens, and calling HTLC.createSwap on the source chain ❌
2. **Bob: Verify Alice's HTLC and create response HTLC** — No UI for reading
   Alice's HTLC, verifying parameters, and creating a response HTLC on target chain ❌
3. **Alice: Withdraw from Bob's HTLC** — No UI to reveal SECRET and claim funds ❌
4. **Bob: Read revealed SECRET and withdraw** — No UI/automation to watch for
   SwapWithdrawn events and extract the secret for withdrawal ❌
5. **Secret management** — No secure storage for secrets between sessions ❌
6. **ERC20 approve flow** — No UI for token approval before HTLC creation ❌
7. **Swap status tracker** — No unified view showing current phase of each swap ❌
8. **Refund UI** — No way to refund expired HTLCs ❌

### The "Match Order" button currently:
- Only calls `CCOB.matchOrder()` to mark status as "Matched"
- Does NOT create any HTLC
- Does NOT lock any tokens
- The order just changes from "Active" to "Matched" in the CCOB, with no real effect

---

## Architecture Recommendation

The full swap requires multiple sequential transactions across two chains.
The frontend needs a **swap state machine** that guides users through each step:

```
Order Created (CCOB)
    ↓
[Alice] Create HTLC on Source Chain (lock sell tokens)
    ↓
Order Matched (CCOB + HTLC linked)
    ↓
[Bob] Verify + Create HTLC on Target Chain (lock buy tokens)
    ↓
[Alice] Withdraw on Target Chain (reveal secret, get buy tokens)
    ↓
[Bob] Withdraw on Source Chain (use revealed secret, get sell tokens)
    ↓
Order Completed (CCOB)
```

Each step should show clear instructions, verification checks, and action buttons.
The backend could assist with monitoring events across chains and notifying users.
