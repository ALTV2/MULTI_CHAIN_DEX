# HTLC Cross-Chain Atomic Swap — Visual Flow

## 1. High-Level Architecture

```mermaid
graph TB
    subgraph SOURCE["SOURCE CHAIN (e.g. Ethereum Sepolia)"]
        direction TB
        CCOB_S["CrossChainOrderBook<br/>─────────────────<br/>createOrder()<br/>matchOrder()<br/>completeOrder()"]
        HTLC_S["HTLC Contract<br/>─────────────────<br/>Creator locks SELL tokens<br/>⏱ Timelock: 48h<br/>🔒 Hashlock: H(secret)"]
        TKA["ERC-20 Token<br/>─────────────────<br/>approve() → HTLC"]
    end

    subgraph TARGET["TARGET CHAIN (e.g. Polygon Amoy)"]
        direction TB
        HTLC_T["HTLC Contract<br/>─────────────────<br/>Matcher locks BUY tokens<br/>⏱ Timelock: 24h<br/>🔒 Hashlock: H(secret)"]
        CCOB_T["CrossChainOrderBook<br/>(optional)"]
    end

    ALICE["🅰 Alice<br/>(Creator / Initiator)<br/>────────────────<br/>Generates SECRET<br/>Sells tokens on Source<br/>Buys tokens on Target"]
    BOB["🅱 Bob<br/>(Matcher / Responder)<br/>────────────────<br/>Fills Alice's order<br/>Locks on Target chain<br/>Reads SECRET from events"]

    ALICE -->|"1. createOrder()"| CCOB_S
    ALICE -->|"2. approve()"| TKA
    ALICE -->|"3. createSwap(hashlock, 48h)"| HTLC_S
    ALICE -->|"4. matchOrder(orderId, swapId)"| CCOB_S
    BOB -->|"5. createSwap(hashlock, 24h)"| HTLC_T
    ALICE -->|"6. withdraw(secret)"| HTLC_T
    BOB -->|"7. withdraw(secret)"| HTLC_S
    BOB -->|"8. completeOrder()"| CCOB_S

    HTLC_T -.-|"SECRET revealed<br/>in SwapWithdrawn event"| BOB

    classDef source fill:#1e3a5f,stroke:#4a9eff,color:#fff,stroke-width:2px
    classDef target fill:#3a1e5f,stroke:#9a4aff,color:#fff,stroke-width:2px
    classDef alice fill:#0d4f3c,stroke:#2ecc71,color:#fff,stroke-width:2px
    classDef bob fill:#4f3a0d,stroke:#f39c12,color:#fff,stroke-width:2px

    class CCOB_S,HTLC_S,TKA source
    class HTLC_T,CCOB_T target
    class ALICE alice
    class BOB bob
```

---

## 2. Full Swap Sequence Diagram

```mermaid
sequenceDiagram
    actor Alice as 🅰 Alice (Creator)
    participant CCOB_S as 📋 CCOB<br/>Source Chain
    participant HTLC_S as 🔐 HTLC<br/>Source Chain
    participant HTLC_T as 🔐 HTLC<br/>Target Chain
    actor Bob as 🅱 Bob (Matcher)

    Note over Alice,Bob: ═══ Phase 1: Order Creation ═══

    Alice ->> Alice: Generate SECRET (32 bytes)<br/>HASHLOCK = keccak256(SECRET)
    Alice ->> CCOB_S: createOrder(sellToken, buyToken,<br/>targetChainId, targetAddress)
    CCOB_S -->> Alice: Order #N created ✅
    Note right of CCOB_S: Status: Active<br/>No tokens locked yet

    Note over Alice,Bob: ═══ Phase 2: Order Discovery ═══

    Bob ->> CCOB_S: getActiveOrdersForTargetChain()
    CCOB_S -->> Bob: Order list
    Note right of Bob: Bob sees Alice's order:<br/>"100 TKA → 0.005 MATIC"

    Note over Alice,Bob: ═══ Phase 3: Creator Locks Tokens (Source Chain) ═══

    Alice ->> HTLC_S: approve(HTLC, 100 TKA)
    Alice ->> HTLC_S: createSwap(bob, HASHLOCK, 48h, TKA, 100)
    HTLC_S -->> HTLC_S: 🔒 100 TKA locked
    Note right of HTLC_S: ⏱ Timelock: 48 hours<br/>Participant: Bob
    Alice ->> CCOB_S: matchOrder(orderId, swapId)
    CCOB_S -->> CCOB_S: Status → Matched

    Note over Alice,Bob: ═══ Phase 4: Matcher Locks Tokens (Target Chain) ═══

    Bob ->> HTLC_S: getSwap(swapId) — verify parameters
    Note right of Bob: ✓ Amount: 100 TKA<br/>✓ Hashlock matches<br/>✓ Timelock: ~48h
    Bob ->> HTLC_T: createSwap(alice, HASHLOCK, 24h, MATIC, 0.005)
    HTLC_T -->> HTLC_T: 🔒 0.005 MATIC locked
    Note left of HTLC_T: ⏱ Timelock: 24 hours<br/>Same HASHLOCK!<br/>Participant: Alice

    Note over Alice,Bob: ═══ Phase 5: Secret Reveal (Alice Withdraws on Target) ═══

    Alice ->> HTLC_T: verify(amount, hashlock, timelock)
    Alice ->> HTLC_T: withdraw(swapId, SECRET) 🔑
    HTLC_T -->> Alice: 💰 0.005 MATIC transferred
    Note over HTLC_T: Event: SwapWithdrawn<br/>🔑 SECRET is now PUBLIC

    Note over Alice,Bob: ═══ Phase 6: Counter-Withdrawal (Bob Claims on Source) ═══

    Bob ->> HTLC_T: Read SwapWithdrawn event
    HTLC_T -->> Bob: 🔑 SECRET extracted from logs
    Bob ->> HTLC_S: withdraw(swapId, SECRET) 🔑
    HTLC_S -->> Bob: 💰 100 TKA transferred

    Note over Alice,Bob: ═══ Phase 7: Completion ═══

    Bob ->> CCOB_S: completeOrder(orderId)
    CCOB_S -->> CCOB_S: Status → Completed ✅

    Note over Alice,Bob: 🎉 Alice got 0.005 MATIC on Polygon<br/>🎉 Bob got 100 TKA on Sepolia
```

---

## 3. Swap Phase State Machine

```mermaid
stateDiagram-v2
    direction LR

    [*] --> order_created: Alice creates order<br/>on CCOB

    order_created --> order_matched: Order matched<br/>(CCOB matchOrder)
    order_created --> cancelled: Alice cancels

    order_matched --> creator_htlc_created: Alice locks tokens<br/>in Source HTLC (48h)
    order_matched --> order_created: Cancel match<br/>(reactivateOrder)

    creator_htlc_created --> matcher_htlc_created: Bob locks tokens<br/>in Target HTLC (24h)
    creator_htlc_created --> refundable: 48h expired<br/>Bob never locked

    matcher_htlc_created --> secret_revealed: Alice withdraws<br/>on Target chain<br/>🔑 SECRET public
    matcher_htlc_created --> refundable: 24h expired<br/>Alice never withdrew

    secret_revealed --> completed: Bob withdraws<br/>on Source chain<br/>using SECRET
    secret_revealed --> refundable: 48h expired<br/>Bob didn't withdraw

    refundable --> refunded: refund() called<br/>tokens returned

    completed --> [*]
    refunded --> [*]
    cancelled --> [*]

    state completed {
        [*] --> Both_Withdrawn
        Both_Withdrawn --> Order_Completed: completeOrder()
    }
```

---

## 4. Timelock Safety Design

```mermaid
gantt
    title Timelock Timeline — Why Matcher's Timelock Must Be Shorter
    dateFormat HH:mm
    axisFormat %H:%M

    section Alice's HTLC
    Alice locks 100 TKA (Source Chain)          :alice_lock, 00:00, 48h
    Alice can REFUND after 48h                  :crit, alice_refund, after alice_lock, 1h

    section Bob's HTLC
    Bob locks 0.005 MATIC (Target Chain)        :bob_lock, 02:00, 24h
    Bob can REFUND after 24h                    :crit, bob_refund, after bob_lock, 1h

    section Actions
    Alice MUST withdraw before Bob's expiry     :active, withdraw_window, 02:00, 24h
    Bob reads SECRET and withdraws              :done, bob_withdraw, 10:00, 2h
```

```
           Timeline:

    T+0h                    T+24h                   T+48h
     │                        │                        │
     ├────── Bob's HTLC ──────┤                        │
     │   (Alice must act!)    │← Bob can refund        │
     │                        │                        │
     ├──────────────── Alice's HTLC ───────────────────┤
     │                                                 │← Alice can refund
     │                                                 │
     │  ✅ SAFE ZONE          │  ⚠️ DANGER ZONE        │
     │  Alice withdraws here  │  Only Alice's HTLC     │
     │  Bob reads secret      │  remains active        │
     │  Bob withdraws here    │                        │
```

---

## 5. Cross-Chain Communication — The Hashlock Bridge

```mermaid
graph LR
    subgraph SEPOLIA["⛓ ETHEREUM SEPOLIA"]
        S1["🔐 Alice's HTLC<br/>──────────────<br/>100 TKA locked<br/>Hashlock: H<br/>Timelock: 48h<br/>For: Bob"]
    end

    subgraph HASHLOCK["🔗 CRYPTOGRAPHIC BRIDGE"]
        H["HASHLOCK = keccak256(SECRET)<br/>━━━━━━━━━━━━━━━━━━━━━━<br/>Same H on both chains<br/>SECRET known only to Alice<br/>Until she reveals it"]
    end

    subgraph POLYGON["⛓ POLYGON AMOY"]
        P1["🔐 Bob's HTLC<br/>──────────────<br/>0.005 MATIC locked<br/>Hashlock: H<br/>Timelock: 24h<br/>For: Alice"]
    end

    S1 ---|"Same H"| HASHLOCK
    HASHLOCK ---|"Same H"| P1

    subgraph REVEAL["🔑 SECRET REVEAL FLOW"]
        R1["Alice calls<br/>withdraw(SECRET)<br/>on Polygon HTLC"]
        R2["Event: SwapWithdrawn<br/>SECRET visible on-chain"]
        R3["Bob reads SECRET<br/>from Polygon events"]
        R4["Bob calls<br/>withdraw(SECRET)<br/>on Sepolia HTLC"]
        R1 --> R2 --> R3 --> R4
    end

    classDef sep fill:#1a3a6b,stroke:#5b9cf5,color:#fff,stroke-width:2px
    classDef pol fill:#4b1a6b,stroke:#b55bf5,color:#fff,stroke-width:2px
    classDef bridge fill:#2a2a2a,stroke:#ffd700,color:#ffd700,stroke-width:3px
    classDef reveal fill:#1a4b2e,stroke:#4ade80,color:#fff,stroke-width:2px

    class S1 sep
    class P1 pol
    class H bridge
    class R1,R2,R3,R4 reveal
```

---

## 6. Failure Scenarios & Safety Net

```mermaid
flowchart TD
    START["🚀 Swap Started"] --> CHECK1{"Alice creates<br/>HTLC?"}

    CHECK1 -->|"❌ No"| SAFE_A["✅ SAFE<br/>No tokens locked<br/>Order stays Active<br/>Cancel anytime"]

    CHECK1 -->|"✅ Yes"| CHECK2{"Bob creates<br/>HTLC?"}

    CHECK2 -->|"❌ No"| REFUND_A["⏱ Wait 48h<br/>Alice calls refund()<br/>Gets 100 TKA back"]

    CHECK2 -->|"✅ Yes"| CHECK3{"Alice reveals<br/>SECRET?"}

    CHECK3 -->|"❌ No"| REFUND_AB["⏱ Wait 24h → Bob refunds MATIC<br/>⏱ Wait 48h → Alice refunds TKA<br/>Nobody loses anything"]

    CHECK3 -->|"✅ Yes"| CHECK4{"Bob uses<br/>SECRET?"}

    CHECK4 -->|"✅ Yes"| SUCCESS["🎉 SUCCESS<br/>Alice: 0.005 MATIC ✅<br/>Bob: 100 TKA ✅"]

    CHECK4 -->|"❌ No (unlikely)"| PARTIAL["⚠️ SECRET is public!<br/>Anyone can call withdraw<br/>for Bob before 48h expiry"]

    PARTIAL --> BOT["🤖 MEV bot or<br/>Bob eventually claims"]
    BOT --> SUCCESS

    classDef safe fill:#1a4b2e,stroke:#4ade80,color:#fff,stroke-width:2px
    classDef danger fill:#4b1a1a,stroke:#f87171,color:#fff,stroke-width:2px
    classDef success fill:#1a3a6b,stroke:#60a5fa,color:#fff,stroke-width:2px
    classDef warning fill:#4b3a0a,stroke:#fbbf24,color:#fff,stroke-width:2px
    classDef neutral fill:#2a2a3a,stroke:#a78bfa,color:#fff,stroke-width:2px

    class SAFE_A safe
    class REFUND_A,REFUND_AB danger
    class SUCCESS success
    class PARTIAL warning
    class START,CHECK1,CHECK2,CHECK3,CHECK4,BOT neutral
```

---

## 7. Multi-Chain Support — EVM + SUI

```mermaid
graph TB
    subgraph FRONTEND["🖥 Frontend (Next.js + React)"]
        direction TB
        UI["SwapCard + SwapStepper + SwapActionPanel"]
        HOOKS["Hooks Layer"]
        ADAPTERS["Chain Adapter Layer"]
    end

    subgraph EVM["⟠ EVM Chains"]
        direction TB
        SEP["Ethereum Sepolia<br/>chainId: 11155111"]
        POL["Polygon Amoy<br/>chainId: 80002"]
        EVM_HTLC["HTLC.sol<br/>CrossChainOrderBook.sol"]
    end

    subgraph SUI["💧 SUI Blockchain"]
        direction TB
        SUI_NET["SUI Testnet<br/>chainId: 'sui:testnet'"]
        SUI_HTLC["htlc.move<br/>cross_chain_order_book.move"]
    end

    UI --> HOOKS

    HOOKS --> |"useHTLC<br/>useCreateOrder<br/>useSwapSecretFromEvent"| ADAPTERS
    HOOKS --> |"useSuiHTLC<br/>useSuiOrders<br/>useSuiSecretWatcher"| ADAPTERS

    ADAPTERS -->|"wagmi + viem"| SEP
    ADAPTERS -->|"wagmi + viem"| POL
    ADAPTERS -->|"@mysten/dapp-kit"| SUI_NET

    SEP --> EVM_HTLC
    POL --> EVM_HTLC
    SUI_NET --> SUI_HTLC

    subgraph SECRET_FLOW["🔑 Cross-Chain Secret Flow"]
        direction LR
        ANY_CHAIN_A["Chain A<br/>withdraw(secret)"]
        EVENT["SwapWithdrawn<br/>event + SECRET"]
        ANY_CHAIN_B["Chain B<br/>withdraw(secret)"]
        ANY_CHAIN_A --> EVENT --> ANY_CHAIN_B
    end

    HOOKS -.->|"useUnifiedSecretWatcher<br/>auto-detects chain type"| SECRET_FLOW

    classDef frontend fill:#1e293b,stroke:#94a3b8,color:#e2e8f0,stroke-width:2px
    classDef evm fill:#1e3a5f,stroke:#4a9eff,color:#fff,stroke-width:2px
    classDef sui fill:#0d3b66,stroke:#00d4aa,color:#fff,stroke-width:2px
    classDef secret fill:#3a1e2e,stroke:#f472b6,color:#fff,stroke-width:2px

    class UI,HOOKS,ADAPTERS frontend
    class SEP,POL,EVM_HTLC evm
    class SUI_NET,SUI_HTLC sui
    class ANY_CHAIN_A,EVENT,ANY_CHAIN_B secret
```

---

## 8. Transaction Summary

```
    ┌─────────────────────────────────────────────────────────────────────┐
    │                    8 On-Chain Transactions                          │
    ├─────┬───────┬──────────────┬──────────┬──────────────────────────────┤
    │  #  │ Actor │    Chain     │ Contract │         Action               │
    ├─────┼───────┼──────────────┼──────────┼──────────────────────────────┤
    │  1  │ Alice │ ⛓ Source     │   CCOB   │ createOrder()                │
    │  2  │ Alice │ ⛓ Source     │   TKA    │ approve(HTLC, amount)        │
    │  3  │ Alice │ ⛓ Source     │   HTLC   │ createSwap(48h) 🔒           │
    │  4  │ Alice │ ⛓ Source     │   CCOB   │ matchOrder(orderId, swapId)  │
    │  5  │  Bob  │ ⛓ Target     │   HTLC   │ createSwap(24h) 🔒           │
    │  6  │ Alice │ ⛓ Target     │   HTLC   │ withdraw(SECRET) 🔑💰        │
    │  7  │  Bob  │ ⛓ Source     │   HTLC   │ withdraw(SECRET) 🔑💰        │
    │  8  │  Any  │ ⛓ Source     │   CCOB   │ completeOrder() ✅           │
    └─────┴───────┴──────────────┴──────────┴──────────────────────────────┘

    Alice: 4 tx (steps 1-4, 6)    Bob: 3 tx (steps 5, 7, 8)
```

---

## 9. The Secret — Heart of the Atomic Swap

```
    ┌───────────────────────────────────────────────────────────────┐
    │                                                               │
    │   SECRET  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
    │   0xa1b2c3d4e5f6...  (32 random bytes)                       │
    │                                                               │
    │            │                                                  │
    │            ▼  keccak256()                                     │
    │                                                               │
    │   HASHLOCK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
    │   0x7f8e9d...  (deterministic hash)                           │
    │                                                               │
    │            │                                                  │
    │            ▼  Used in BOTH HTLCs                              │
    │                                                               │
    │   ┌──────────────────┐        ┌──────────────────┐           │
    │   │  Source HTLC     │        │  Target HTLC     │           │
    │   │  hashlock: H     │◄──────►│  hashlock: H     │           │
    │   │  100 TKA locked  │  SAME  │  0.005 MATIC     │           │
    │   │  for Bob         │   H    │  locked for Alice │           │
    │   └──────────────────┘        └──────────────────┘           │
    │                                                               │
    │   ┌─────────────────────────────────────────────────────┐    │
    │   │  ATOMICITY GUARANTEE:                                │    │
    │   │  • SECRET unlocks BOTH contracts                     │    │
    │   │  • Revealing it on one chain = revealing everywhere  │    │
    │   │  • Either both withdraw, or both refund              │    │
    │   └─────────────────────────────────────────────────────┘    │
    │                                                               │
    └───────────────────────────────────────────────────────────────┘
```
