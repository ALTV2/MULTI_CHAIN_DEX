# Security Policy

## Supported Versions

This project is currently in active development. Only the `main` branch and
the most recent release are eligible for security fixes.

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |
| `< 2.0` | :x:                |

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

If you discover a security issue in the smart contracts, backend services,
or frontend, send a private report to:

📧 **tveritin09@gmail.com**

When reporting, please include:

- A description of the issue and its potential impact
- Steps to reproduce, or a proof-of-concept if available
- The affected component (contracts / backend / frontend) and version/commit
- Your name or handle for credit (optional)

You can expect:

- Acknowledgement within **3 business days**
- An initial assessment and triage within **7 business days**
- Coordinated disclosure once a fix is available — credit will be given in
  the release notes unless you prefer to remain anonymous

## Scope

In-scope for security reporting:

- HTLC smart contracts (`ethereum/`, `polygon/`, `sui/`) — secret leakage,
  fund-locking bugs, timelock bypass, hashlock collisions, reentrancy
- Backend services (`backend/indexer-service`, `backend/notification-service`)
  — auth bypass, indexer state corruption, Kafka/SMTP injection
- Frontend (`frontend/`) — XSS, secret leakage to logs/network, wallet
  signature manipulation

Out of scope:

- Self-DoS by misconfiguring rate limits / RPC quotas
- Vulnerabilities in third-party dependencies that have not been actively
  exploited against this project (please report to the upstream maintainer)
- Issues that require physical access to a user's device or wallet

## Known limitations (accepted for the testnet prototype)

These are understood trade-offs of a plain HTLC design, documented rather than
fixed in the current version:

- **HTLC free-option / optionality griefing (E-1).** The order creator holds the
  secret and locks the long-timelock leg first; the matcher then locks the
  short-timelock (≈24 h) leg. The creator can choose *not* to reveal the secret,
  in which case the matcher's capital is frozen until its timelock expires and the
  matcher then refunds. No funds are stolen (the protocol stays atomic — see the
  timelock invariant in §1.4.5 / §4.6.2), but the creator effectively obtains a
  free ~24 h option on price while the matcher's capital is locked at zero cost to
  the creator. This is inherent to bridgeless/oracle-free HTLC swaps. Production
  mitigations (out of scope for this prototype): require a non-refundable
  safety-deposit / option premium from the creator that the matcher claims on
  non-reveal, and/or shorten the absolute timelocks and the T₁−T₂ gap to reduce
  option value. Matchers should price in this optionality and prefer reputable
  counterparties.

## Re-audit follow-ups

A second adversarial pass re-verified the applied fixes and surfaced further items. The two
highest-value ones have since been **implemented in source**:

- **Contract-bound swap IDs (V-4) — fixed in source (takes effect on next deploy).** `createSwap`
  now requires `_swapId == keccak256(abi.encode(initiator, participant, hashlock, timelock,
  chainId))` (`HTLC.sol` `_deriveSwapId`, both chains), binding the id to its parameters so a
  caller cannot supply an arbitrary/decoy id. The off-chain derivation
  (`frontend/lib/utils/crossChainCrypto.ts` `generateSwapId`) already matches this encoding
  byte-for-byte (locked by a unit test). Requires a redeploy to take effect on the live contracts.

- **SUI-leg counterparty verification (V-1/V-2) — fixed.** The SUI→EVM counter-HTLC creation
  verifies the matcher's EVM HTLC before the creator commits SUI funds, and every SUI withdraw now
  fail-closed verifies the on-chain Swap object before revealing the secret
  (`frontend/lib/utils/suiSwapVerify.ts` `assertSuiClaimableByMe`: status Active, participant ==
  me, hashlock match, balance > 0). A precise `minAmount` check remains as a follow-up.

The remaining items (V-11 indexer DoS, V-10 metadata front-running, V-7 SUI overpayment, SUI
`add_supported_chain` access control, order-book spam, rebasing-token coverage, the E-1 free-option
griefing limitation, and the SUI `minAmount` follow-up) are tracked with concrete remediations in
[`docs/FUTURE_WORK.md`](docs/FUTURE_WORK.md). None is an active fund-theft vector given the on-chain
timelock invariant plus the client-side HTLC verification already in place.

## Disclaimer

This software is provided **as-is** for educational and testnet purposes.
It has not undergone a professional security audit. **Do not use it with
mainnet funds.** See the project [README](README.md) for full details.
