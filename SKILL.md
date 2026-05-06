---
name: the-cauldron
description: The Cauldron NFT launchpad & marketplace on Ritual Chain. User-owned autonomous agent infrastructure.
user_invocable: true
---

<!-- AGENT OPERATING RULES — Read before doing anything. -->
<!-- Rule 0: Ritual ≠ Ethereum — block.timestamp is MILLISECONDS (not seconds). Date.now() / 1000 will create phases that expired decades ago. Always use Date.now() directly. -->
<!-- Rule 1: Sender Lock — Ritual enforces 1 async job per EOA. If you fire a second precompile tx while the first is pending, the block builder will revert. Serialize all async calls. -->
<!-- Rule 2: Fresh Checkout — Always `git pull origin main` before reading file paths. If a file is missing, your checkout is stale. -->
<!-- Rule 3: Signer Boundary — Agents CANNOT sign without a --key. If no key is provided, prepare and instruct — do not attempt transactions. -->
<!-- Rule 4: Gas Limits Required — Ritual Chain gas estimation can fail. Always set explicit gas limits. -->
<!-- Rule 5: Scope — All file writes within the project root. -->

# The Cauldron — Agent Skill File

> **Platform:** The Cauldron — NFT Launchpad & Marketplace on Ritual Chain
> **Chain:** Ritual Chain (ID: 1979)
> **Currency:** RITUAL (18 decimals, testnet)
> **RPC:** https://rpc.ritualfoundation.org
> **Explorer:** https://explorer.ritualfoundation.org
> **Skill Version:** 6.0 (2026-05-06)

---

## What This Is

The Cauldron is **infrastructure for user-owned AI agents** on Ritual Chain. Each user deploys their own agent contract, funds it with RITUAL, and runs a local Python server that gives the agent autonomous control over NFT operations.

**The agent can:**
- Deploy NFT collections
- Buy NFTs from the marketplace
- List NFTs for sale
- Cancel listings
- Read collection data and marketplace state

**The agent cannot (without user action):**
- Deploy its own contract (user does this once)
- Access more funds than the user provides

---

## Quick Start

### 1. Create a Hot Wallet

Create a **dedicated** wallet for the agent (never use your main wallet's key):

```bash
# MetaMask → Create Account → copy private key
# Fund it with enough for gas + trading
cast send 0xNewHotWallet --value 0.1ether --rpc-url https://rpc.ritualfoundation.org --private-key $YOUR_MAIN_KEY
```

### 2. Deploy Agent Contract

Connect the hot wallet in MetaMask, then deploy. The hot wallet becomes the contract owner.

```bash
python3 agent/agent.py --deploy
# Open http://localhost:8888 → Connect hot wallet in MetaMask → Click Deploy
# Note the deployed agent address
```

### 3. Start Agent in Autonomous Mode

```bash
pip install web3

# Start the agent (use env var for safety)
export AGENT_HOT_KEY=0xHotWalletPrivateKey
python3 agent/agent.py --address 0xYourDeployedAgent
```

The agent is now live at `http://localhost:8888` with full execution capability.

---

## Execution API

When started with `--key` (or `AGENT_HOT_KEY` env var), the agent exposes these endpoints:

### Endpoints

| Method | Path | Body | Action |
|---|---|---|---|
| `POST` | `/api/buy` | `{"nft":"0x...","tokenId":1,"price":"0.05"}` | Buy NFT |
| `POST` | `/api/list` | `{"nft":"0x...","tokenId":1,"price":"0.1"}` | List NFT for sale |
| `POST` | `/api/cancel` | `{"nft":"0x...","tokenId":1}` | Cancel a listing |
| `GET` | `/api/info` | — | Agent status, balance, policy |
| `GET` | `/health` | — | Health check |

### Examples

**Buy an NFT:**
```bash
curl -X POST http://localhost:8888/api/buy \
  -H "Content-Type: application/json" \
  -d '{"nft":"0x1234...","tokenId":1,"price":"0.05"}'
```

**List an NFT for sale:**
```bash
curl -X POST http://localhost:8888/api/list \
  -H "Content-Type: application/json" \
  -d '{"nft":"0x1234...","tokenId":3,"price":"0.1"}'
```

**Cancel a listing:**
```bash
curl -X POST http://localhost:8888/api/cancel \
  -H "Content-Type: application/json" \
  -d '{"nft":"0x1234...","tokenId":3}'
```

**Check agent status:**
```bash
curl http://localhost:8888/api/info
```

### Response Format

```json
{
  "ok": true,
  "tx_hash": "0xabc...",
  "block": 12345,
  "status": 1
}
```

On error:
```json
{
  "error": "reason string"
}
```

---

## Deployed Contracts

| Contract | Address | Role |
|---|---|---|
| **NFTFactory** | `0xCeD6f5eA4b8e9D448fF732Ef44267D6cbD9F750f` | Deploys NFT collections (EIP-1167 clones) |
| **RitualMarketplace** | `0x9cDB207D834c1c5FE3b1777fC360eC4473f5A38B` | NFT marketplace with ERC-2981 royalties |
| **AIRitualNFT (impl)** | `0xBCea72054CEd720c797501fdA3Eb07866C12d67b` | Collection template |
| **CauldronAgent** | User-deployed (ref: `0xCb9d6B52110f6b493D6F39aCC92CC077f6B4D28f`) | Autonomous agent contract |

---

## Agent Architecture

```
User (chat) → AI Agent → curl localhost:8888/api/* → agent.py → signs tx → Ritual Chain
                                                        ↑
                                                   hot wallet key
```

### Files

| File | Purpose |
|---|---|
| `agent/agent.py` | Local server: dashboard + execution API |
| `agent/CauldronAgent.json` | Contract ABI + bytecode (for deploy mode) |
| `contracts/src/CauldronAgent.sol` | Agent contract source |
| `contracts/scripts/deploy-agent.ts` | Hardhat deploy script (alternative) |
| `SKILL.md` | This file — agent reads for capabilities |

### CLI Flags

```
python3 agent/agent.py [options]

  --deploy              Deploy mode: MetaMask-based deploy UI
  --address 0x...       Agent contract address
  --key 0x...           Hot wallet private key (or use AGENT_HOT_KEY env)
  --port 8888           Server port (default: 8888)
  --skill ./SKILL.md    Custom SKILL.md path
```

### Dependencies

- **Monitoring mode** (no --key): Python 3.6+ stdlib only
- **Autonomous mode** (with --key): `pip install web3`

---

## Dashboard

The dashboard at `http://localhost:8888` shows:

- **Agent Balance** — how much RITUAL the agent has
- **Total Spent** — cumulative spending
- **Actions Executed** — transaction count
- **Pending Queue** — supervised-mode queue
- **Policy Controls** — mode, spend ceiling, permissions
- **Activity Log** — on-chain events

The dashboard is for **monitoring and policy only**. The agent handles all actions via chat.

---

## Policy Settings

Users control agent behavior through on-chain policy:

| Setting | Values | Purpose |
|---|---|---|
| **Mode** | SUPERVISED / AUTONOMOUS / DRY_RUN | Controls execution behavior |
| **Spend Ceiling** | RITUAL amount | Max per-action spend |
| **Min Confidence** | 0-100% | AI confidence threshold |
| **Allow Buy** | true/false | Can the agent buy NFTs |
| **Allow List** | true/false | Can the agent list NFTs |
| **Allow Cancel** | true/false | Can the agent cancel listings |

**Modes:**
- `SUPERVISED` — agent queues actions, user approves
- `AUTONOMOUS` — agent executes immediately
- `DRY_RUN` — agent logs actions but doesn't execute

---

## NFT Operations Reference

### Deploy a New Collection

**Contract:** `NFTFactory.createCollection()`

```solidity
function createCollection(
    string name,
    string symbol,
    string baseURI,
    address royaltyReceiver,
    uint96  royaltyBps,          // 500 = 5%
    MintPhase[] phases
)
```

**MintPhase struct:**
```solidity
struct MintPhase {
    uint256 price;               // in wei
    uint256 maxPerWallet;
    uint256 startTime;           // MILLISECONDS (Date.now())
    uint256 endTime;             // MILLISECONDS
    bytes32 merkleRoot;          // 0x00...00 for public
    string  name;
}
```

**Gas:** `500000`

### List an NFT

**Contract:** `RitualMarketplace.listItem()`

```solidity
function listItem(address nft, uint256 tokenId, uint256 price)
```

Requires: `nft.approve(marketplace, tokenId)` first.

**Gas:** `200000` (approve) + `200000` (list)

### Buy an NFT

**Contract:** `RitualMarketplace.buyItem()`

```solidity
function buyItem(address nft, uint256 tokenId)  // payable — send price as value
```

**Gas:** `300000`

### Cancel a Listing

**Contract:** `RitualMarketplace.cancelListing()`

```solidity
function cancelListing(address nft, uint256 tokenId)
```

**Gas:** `100000`

### Mint an NFT

```solidity
// Public mint
function mint(uint256 phaseIndex, uint256 quantity)  // payable

// Allowlist mint
function allowlistMint(uint256 phaseIndex, uint256 quantity, bytes32[] proof)  // payable

// Owner mint (free)
function ownerMint(address to, uint256 quantity)
```

**Gas:** `200000`

---

## Read-Only Queries

### Get All Collections

```solidity
NFTFactory.getCollections() returns (address[])
```

### Get Collection Info

```solidity
AIRitualNFT.name() returns (string)
AIRitualNFT.symbol() returns (string)
AIRitualNFT.totalSupply() returns (uint256)
AIRitualNFT.baseURI() returns (string)
AIRitualNFT.getMintPhases() returns (MintPhase[])
```

### Check Listing

```solidity
RitualMarketplace.listings(address nft, uint256 tokenId) returns (address seller, uint256 price)
```

---

## Gas Limits

| Operation | Gas |
|---|---|
| `createCollection` | `500000` |
| `mint` / `allowlistMint` | `200000` |
| `listItem` | `200000` |
| `buyItem` | `300000` |
| `cancelListing` | `100000` |
| `setPolicy` | `100000` |
| `requestDecision` | `500000` |
| `directBuy` | `300000` |
| `directList` | `200000` |
| `directCancel` | `100000` |

---

## Timestamp Rule

Ritual Chain uses **milliseconds** for `block.timestamp`.

```javascript
// CORRECT
startTime: Date.now()
endTime:   Date.now() + (7 * 24 * 60 * 60 * 1000)

// WRONG — creates expired phases
startTime: Math.floor(Date.now() / 1000)
```

---

## IPFS Metadata Format

### Single Image
```json
{
  "name": "Collection Name",
  "description": "...",
  "image": "ipfs://Qm.../image.png"
}
```

### Multi-Token (baseURI = `ipfs://QmHash/`)
Each token file: `0.json`, `1.json`, etc.
```json
{
  "name": "Token #0",
  "description": "...",
  "image": "ipfs://Qm.../0.png",
  "attributes": [
    {"trait_type": "Rarity", "value": "Legendary"}
  ]
}
```

---

## Agent Workflow Examples

### Buy an NFT via Chat

User says: *"Buy token #5 from collection 0xABC for 0.03 RITUAL"*

Agent runs:
```bash
curl -X POST http://localhost:8888/api/buy \
  -H "Content-Type: application/json" \
  -d '{"nft":"0xABC...","tokenId":5,"price":"0.03"}'
```

### List an NFT via Chat

User says: *"List my NFT #12 from 0xDEF at 0.1 RITUAL"*

Agent runs:
```bash
curl -X POST http://localhost:8888/api/list \
  -H "Content-Type: application/json" \
  -d '{"nft":"0xDEF...","tokenId":12,"price":"0.1"}'
```

### Check Agent Status

Agent runs:
```bash
curl http://localhost:8888/api/info
```

Response includes balance, mode, spend ceiling, and action count.

---

## Error Reference

| Error | Cause | Fix |
|---|---|---|
| `transaction type not supported` | Using EIP-1559 on Ritual | Remove `type` field, use `gasPrice` |
| `InsufficientFunds` | Not enough RITUAL | Fund the hot wallet |
| `NotOwner` | Wrong wallet calling owner functions | Use the contract owner's key |
| `ExceedsSpendCeiling` | Price > agent's spend ceiling | Update policy via dashboard |
| `ActionNotAllowed` | Policy blocks this action type | Enable buy/list/cancel in policy |
| `503 No execution engine` | Server started without `--key` | Restart with `--key` flag |

---

## Security

- **Never use your main wallet's private key** — create a dedicated hot wallet
- **Fund the hot wallet with small amounts** — only what the agent needs
- **Policy is on-chain** — even if the server is compromised, the contract enforces spend ceilings
- **SUPERVISED mode** is default — switch to AUTONOMOUS only when confident
- The agent **always identifies itself as an agent** — never impersonates a human
