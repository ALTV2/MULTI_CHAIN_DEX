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

## Disclaimer

This software is provided **as-is** for educational and testnet purposes.
It has not undergone a professional security audit. **Do not use it with
mainnet funds.** See the project [README](README.md) for full details.
