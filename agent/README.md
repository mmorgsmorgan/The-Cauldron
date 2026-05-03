# CauldronAgent — Local Self-Hosted UI

A lightweight agent frontend that runs **locally** using Python's built-in HTTP server.  
**No Node.js. No npm. No build step.** Python 3 stdlib only.

---

## How It Works

```
1. Agent reads SKILL.md from GitHub (or local file)
2. Agent parses its capabilities and contract addresses
3. Agent generates a tailored single-page HTML dashboard
4. Agent serves it at http://localhost:8888
5. User connects MetaMask → agent takes full control
```

Each agent instance generates its own UI based on the skills it loaded.  
The main Cauldron site handles identity/discovery — the agent handles execution.

---

## Quick Start

```bash
# Basic — fetches SKILL.md from GitHub automatically
python3 agent.py --address 0xYourAgentContractAddress

# With local SKILL.md
python3 agent.py --address 0xYourAgentContractAddress --skill ../SKILL.md

# Custom port
python3 agent.py --address 0xYourAgentContractAddress --port 9000
```

Then open **http://localhost:8888** in your browser.

---

## Deploy Your Agent First

Before running the UI, deploy `CauldronAgent.sol`:

```bash
cd ../contracts
npx hardhat run scripts/deploy-agent.ts --network ritual
```

Copy the deployed address and pass it as `--address`.

---

## Requirements

- Python 3.6+ (pre-installed on Linux/Mac/WSL)
- MetaMask browser extension
- A deployed `CauldronAgent.sol` contract address

---

## Architecture

```
agent.py (Python stdlib)
├── Reads SKILL.md → parses skill version, chain, contracts
├── Generates index.html (pure HTML/CSS/JS, ethers.js via CDN)
└── Serves on http://localhost:PORT

index.html (generated)
├── Connects MetaMask → switches to Ritual Chain (1979)
├── Reads agent state (balance, policy, queue) every 8s
├── setPolicy() → on-chain transaction
├── requestDecision() → Sovereign Agent precompile
├── directBuy() / directList() → marketplace
└── Activity log with timestamps
```

---

## Self-Managed Deployment

Agents can be assigned a public address (domain/IP) for remote access:

```bash
# Bind to all interfaces for public access
python3 agent.py --address 0x... --port 8888
# Then assign a domain: agent.yourcauldron.xyz → this server
```

The main Cauldron site only handles:
- NFT collection discovery
- Public marketplace browsing
- Pointing users to their agent URL

Everything else — policy, decisions, execution — is handled by the agent's own server.
