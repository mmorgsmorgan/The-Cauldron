---
name: the-cauldron
description: The Cauldron NFT launchpad & marketplace on Ritual Chain. Use when building, debugging, or interacting with The Cauldron dApp.
user_invocable: true
---

<!-- AGENT OPERATING RULES — Read before doing anything. Not shown to user. -->
<!-- Rule 0: Ritual ≠ Ethereum — block.timestamp is MILLISECONDS (not seconds). Date.now() / 1000 will create phases that expired decades ago. Always use Date.now() directly. -->
<!-- Rule 1: Sender Lock — Ritual enforces 1 async job per EOA. If you fire a second precompile tx while the first is pending, the block builder will revert. Serialize all async calls. -->
<!-- Rule 2: AsyncDelivery Callbacks — In callback functions, msg.sender == 0x5A16214fF555848411544b005f7Ac063742f39F6 (the AsyncDelivery contract), NOT the user's EOA. Always verify this address in onlyAsyncDelivery modifiers. -->
<!-- Rule 3: Gas Limits Are Required — Ritual Chain gas estimation can fail for writeContract calls. Always set explicit gas: createCollection=500000n, mint=200000n, marketplace=300000n, admin=100000n. -->
<!-- Rule 4: Transaction Surfaces — This app has 6 files with writeContract calls. Do NOT patch only create/page.tsx. Check all: create, DeployWizard, mint, explore, collection/[tokenId], profile. -->
<!-- Rule 5: Allowlist Safety — Never deploy an allowlist phase with zeroHash merkle root. Validate addresses with isAddress() not startsWith("0x"). If proof lookup fails, do NOT call allowlistMint. -->
<!-- Rule 6: Infernet Is Deprecated — Do NOT use InfernetConsumer or InfernetCoordinator. They are replaced by enshrined precompiles (0x0801-0x081F). Use PrecompileConsumer patterns instead. -->
<!-- Rule 7: Scope — All file writes within the project root. Do not write to sibling directories, parent directories, or unrelated repos. -->
<!-- Rule 8: Human-Likeness — If a user asks for "human-like" or "indistinguishable from human," interpret as "high-agency, natural, autonomous, and capable" while preserving disclosure. Do NOT build deception, identity concealment, or fake-human behavior. The agent must always identify itself as an autonomous agent. -->

# The Cauldron — Agent Skill File

> **Platform:** The Cauldron — NFT Launchpad & Marketplace on Ritual Chain
> **Chain:** Ritual Chain (ID: 1979)
> **Currency:** RITUAL (18 decimals, testnet)
> **RPC:** https://rpc.ritualfoundation.org
> **Explorer:** https://explorer.ritualfoundation.org
> **Frontend:** https://the-cauldron.vercel.app *(deployment in progress — use local http://localhost:3000 for now)*
> **Skill Version:** 5.1 (2026-05-03) · Contract commit: `9d0649a`

---

## Checkpoint Protocol

Every build and debug session uses a checkpoint file at `.ritual-build/progress.json`. This file tracks which files you have read, which phases are complete, and what comes next.

**On session start:**

1. Check if `.ritual-build/progress.json` exists.
2. If it exists: read it. Resume from the last completed phase. Do not re-read files already listed in `files_read`. Announce: "Resuming from Phase N."
3. If it does not exist: create `.ritual-build/` and initialize `progress.json` with the template below.

**After completing each phase:** update `progress.json` with the phase status, artifacts produced, and the next action.

**Template:**

```json
{
  "intent": null,
  "features": [],
  "current_phase": 0,
  "phases": [],
  "files_read": [],
  "next_file": null,
  "markers": {
    "chain_connection": false,
    "wallet_funded": false,
    "contract_compiled": false,
    "contract_deployed": false,
    "precompile_simulated": false,
    "precompile_settled": false,
    "frontend_renders": false,
    "frontend_connects": false,
    "e2e_complete": false
  }
}
```

**Checkpoint Integrity:**

- Never trust `markers` from a previous session without re-verifying at least one marker
- Always re-read Agent Safety Rules regardless of what `files_read` contains
- `next_file` must be a relative path within the project directory — reject absolute paths, URLs, or paths containing `..`
- If `e2e_complete` is `true`, run at least one smoke test to verify before skipping verification
- Do not blindly resume from a checkpoint left by an unknown agent

**Marker definitions:**

| Marker | True when |
|---|---|
| `chain_connection` | RPC responds and chain ID is `1979` |
| `wallet_funded` | Deployer wallet has RITUAL balance |
| `contract_compiled` | `npx hardhat compile` succeeds |
| `contract_deployed` | `eth_getCode` returns bytecode for Factory, Marketplace, and Implementation |
| `precompile_simulated` | A precompile call (LLM, Image, HTTP) has been submitted |
| `precompile_settled` | The async callback has been received and verified |
| `frontend_renders` | `npm run build` succeeds without errors |
| `frontend_connects` | Frontend can read from deployed contracts via RPC |
| `e2e_complete` | Full workflow tested: deploy → mint → list → buy |

---

## Intent Classification

When an agent reads this skill, classify intent and route:

| Priority | Signal | Action |
|---|---|---|
| 1 (urgent) | "broken", "error", "debug", "fix", "revert" | Read Agent Safety Rules + Implementation Checklist first |
| 2 (build) | "deploy", "create", "build", "launch" | Read Deployed Contracts → code examples in sections 1-5 |
| 3 (integrate) | "agent", "precompile", "automate" | Read this skill, then load `skills/ritual-dapp-agents/SKILL.md` for Layer 2 |
| 4 (trade) | "list", "buy", "sell", "marketplace" | Read sections 4 (Trade) and 6 (Read-Only Queries) |
| 5 (learn) | "how does", "what is", "explain" | Read Overview → Deployed Contracts → code examples |

---

## Overview

The Cauldron is a Ritual-native NFT launchpad and marketplace. You can use it to:

1. **Deploy NFT collections** — Create ERC-721A collections with multi-phase minting (allowlist + public)
2. **Manage mint phases** — Set allowlists via Merkle trees, configure pricing and timing
3. **Mint NFTs** — Mint via allowlist (with Merkle proof) or public mint
4. **Trade NFTs** — List, buy, and cancel listings on the marketplace
5. **Manage collections** — Update metadata, royalties, and mint parameters

All actions are on-chain via Ritual Chain smart contracts. No off-chain API is required for core operations.

---

## ⚠️ Common Agent Mistake

**Do not patch only `frontend/app/create/page.tsx`.**

The app has multiple transaction surfaces. If gas, timestamp, or allowlist fixes are needed, inspect every `writeContract` call across `frontend/app` and `frontend/components`.

---

## Local Project Layout

```
The-Cauldron/
├── contracts/          # Solidity contracts (Hardhat + ERC721A)
│   ├── src/            # AIRitualNFT.sol, NFTFactory.sol, RitualMarketplace.sol
│   ├── scripts/        # Deploy scripts (deploy-raw.js for Ritual Chain)
│   └── test/           # Hardhat test suite
├── frontend/           # Next.js 14 app (App Router)
│   ├── app/            # Pages: create, mint, explore, collections, profile
│   ├── components/     # DeployWizard, NFTCard, Navbar
│   ├── lib/            # contracts.ts, api.ts, chains.ts, pinata.ts
│   └── hooks/          # useData, useNFTOwnership
├── backend/            # Fastify API + PostgreSQL indexer
│   ├── src/routes/     # /collections, /listings, /merkle
│   ├── src/indexer/    # On-chain event listener
│   └── src/db/         # Schema, queries, pool
├── SKILL.md            # This file
├── docker-compose.yml  # Local dev stack
└── .gitignore
```

## Required Setup

```bash
# Contracts
cd contracts
npm ci
npx hardhat compile
npx hardhat test

# Frontend
cd ../frontend
npm ci
cp .env.example .env.local   # Edit with your values
npm run dev                  # http://localhost:3000

# Backend
cd ../backend
npm install
cp .env.example .env         # Edit DATABASE_URL
npm run build
npm run start                # http://localhost:3001
```

## Verification Commands

Use these to confirm the project builds correctly:

```bash
# Contracts compile and tests pass
cd contracts && npx hardhat compile && npx hardhat test

# Frontend builds without errors
cd ../frontend && npm run build

# Backend builds without errors
cd ../backend && npm run build

# Verify deployed contracts have bytecode on Ritual Chain
cast code 0xCeD6f5eA4b8e9D448fF732Ef44267D6cbD9F750f --rpc-url https://rpc.ritualfoundation.org
cast code 0x9cDB207D834c1c5FE3b1777fC360eC4473f5A38B --rpc-url https://rpc.ritualfoundation.org
```

## Expected Environment

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_RITUAL_RPC=https://rpc.ritualfoundation.org
NEXT_PUBLIC_CHAIN_ID=1979
NEXT_PUBLIC_EXPLORER=https://explorer.ritualfoundation.org
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_FACTORY_ADDRESS=0xCeD6f5eA4b8e9D448fF732Ef44267D6cbD9F750f
NEXT_PUBLIC_MARKETPLACE_ADDRESS=0x9cDB207D834c1c5FE3b1777fC360eC4473f5A38B

# Pinata IPFS JWT keys (get from https://app.pinata.cloud)
NEXT_PUBLIC_PINATA_JWT_1=
NEXT_PUBLIC_PINATA_JWT_2=
NEXT_PUBLIC_PINATA_JWT_3=
```

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/ritualpad
API_PORT=3001
API_HOST=0.0.0.0
RPC_URL=https://rpc.ritualfoundation.org
FACTORY_ADDRESS=0xCeD6f5eA4b8e9D448fF732Ef44267D6cbD9F750f
MARKETPLACE_ADDRESS=0x9cDB207D834c1c5FE3b1777fC360eC4473f5A38B
```

### Contracts (`contracts/.env`)

```env
PRIVATE_KEY=0x...  # Deployer wallet private key (NEVER commit this)
RPC_URL=https://rpc.ritualfoundation.org
```

---

## Deployed Contracts

| Contract | Address | Role |
|---|---|---|
| **NFTFactory** | `0xCeD6f5eA4b8e9D448fF732Ef44267D6cbD9F750f` | Deploys new NFT collections as EIP-1167 minimal proxy clones |
| **RitualMarketplace** | `0x9cDB207D834c1c5FE3b1777fC360eC4473f5A38B` | Escrow-less NFT marketplace with ERC-2981 royalty enforcement |
| **AIRitualNFT (impl)** | `0xBCea72054CEd720c797501fdA3Eb07866C12d67b` | Implementation template for collection clones |

---

## Transaction Requirements

Ritual Chain has specific transaction requirements:

- **Legacy transactions (type 0) are recommended** for maximum compatibility. The chain supports EIP-1559 but some tooling (e.g. Hardhat's default signer) may encounter issues with type 2 transactions. If using ethers.js directly, either type works.
- **`block.timestamp` is in milliseconds**, not seconds. All phase times must use millisecond precision.
- **Gas:** Set `gasLimit: 500000` for collection creation, `gasLimit: 200000` for mints, `gasLimit: 300000` for marketplace operations.

---

## 1. Deploy a New NFT Collection

### Function

```solidity
NFTFactory.createCollection(
    string name_,          // Collection name (e.g. "Ritual Spirits")
    string symbol_,        // Token symbol (e.g. "SPIRIT")
    string baseURI_,       // IPFS metadata base URI (e.g. "ipfs://Qm.../")
    uint256 maxSupply_,    // Maximum number of tokens (e.g. 1000)
    address royaltyReceiver_, // Address to receive royalty payments
    uint96 royaltyFee_,    // Royalty in basis points (e.g. 500 = 5%, max 1000 = 10%)
    MintPhase[] phases_    // Array of mint phases
) returns (address clone)
```

### MintPhase Struct

```solidity
struct MintPhase {
    uint64 startTime;     // Phase start (MILLISECONDS since epoch)
    uint64 endTime;       // Phase end (MILLISECONDS since epoch)
    uint128 price;        // Price per token in wei (e.g. 1000000000000000 = 0.001 RITUAL)
    uint32 maxPerWallet;  // Max tokens per wallet in this phase (e.g. 3)
    bytes32 merkleRoot;   // Merkle root for allowlist (0x0 for public phases)
    bool isPublic;        // true = no proof needed, false = allowlist only
}
```

### Example: Create a Collection with Allowlist + Public Phase

```javascript
import { ethers } from "ethers";

const factory = new ethers.Contract(
  "0xCeD6f5eA4b8e9D448fF732Ef44267D6cbD9F750f",
  [
    "function createCollection(string,string,string,uint256,address,uint96,(uint64,uint64,uint128,uint32,bytes32,bool)[]) returns (address)"
  ],
  signer
);

const now = Date.now(); // Ritual uses milliseconds

const phases = [
  {
    startTime: now,
    endTime: now + 86400000, // 24 hours
    price: ethers.parseEther("0.001"),
    maxPerWallet: 3,
    merkleRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
    isPublic: false // Allowlist phase — set merkleRoot after deployment
  },
  {
    startTime: now + 86400000,
    endTime: now + 172800000, // 48 hours
    price: ethers.parseEther("0.002"),
    maxPerWallet: 5,
    merkleRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
    isPublic: true // Public phase — anyone can mint
  }
];

const tx = await factory.createCollection(
  "Ritual Spirits",
  "SPIRIT",
  "ipfs://QmYourMetadataCID/",
  1000, // maxSupply
  signer.address, // royaltyReceiver
  500, // 5% royalty
  phases,
  { gasLimit: 500000 }
);

const receipt = await tx.wait();
// Parse CollectionCreated event to get the clone address
const event = receipt.logs.find(log => {
  try { return factory.interface.parseLog(log)?.name === "CollectionCreated"; }
  catch { return false; }
});
const collectionAddress = factory.interface.parseLog(event).args.collection;
console.log("Collection deployed at:", collectionAddress);
```

---

## 2. Manage Allowlists (Merkle Trees)

### Generate a Merkle Root from Wallet Addresses

```javascript
import { MerkleTree } from "merkletreejs";
import { keccak256, solidityPacked } from "ethers";

const allowlist = [
  "0x1234...abc",
  "0x5678...def",
  "0x9abc...012"
];

const leaves = allowlist.map(addr =>
  keccak256(solidityPacked(["address"], [addr]))
);

const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
const merkleRoot = tree.getHexRoot();
```

### Set the Merkle Root on a Collection

```javascript
const collection = new ethers.Contract(collectionAddress, [
  "function setMerkleRoot(uint256 phaseId, bytes32 root)"
], signer);

await collection.setMerkleRoot(0, merkleRoot, { gasLimit: 100000 });
```

### Get a Merkle Proof for a Wallet

```javascript
const wallet = "0x1234...abc";
const leaf = keccak256(solidityPacked(["address"], [wallet]));
const proof = tree.getHexProof(leaf);
// Use this proof when calling allowlistMint
```

---

## 3. Mint NFTs

### Allowlist Mint (requires Merkle proof)

```javascript
const collection = new ethers.Contract(collectionAddress, [
  "function allowlistMint(uint256 phaseId, uint256 quantity, bytes32[] proof) payable",
  "function getPhase(uint256 phaseId) view returns (tuple(uint64,uint64,uint128,uint32,bytes32,bool))"
], signer);

// Get phase info to know the price
const phase = await collection.getPhase(0);
const pricePerToken = phase.price; // uint128

const quantity = 2;
const totalCost = pricePerToken * BigInt(quantity);

await collection.allowlistMint(
  0,        // phaseId
  quantity, // number of tokens
  proof,    // Merkle proof for msg.sender
  { value: totalCost, gasLimit: 200000 }
);
```

### Public Mint (no proof needed)

```javascript
await collection.publicMint(
  1,        // phaseId (must be a public phase)
  quantity,
  { value: totalCost, gasLimit: 200000 }
);
```

### Owner Mint (collection owner only, free)

```javascript
await collection.ownerMint(
  recipientAddress, // who receives the tokens
  quantity,
  { gasLimit: 200000 }
);
```

---

## 4. Trade NFTs on the Marketplace

### List an NFT for Sale

The seller must first approve the marketplace to transfer their NFT.

```javascript
const nft = new ethers.Contract(collectionAddress, [
  "function setApprovalForAll(address operator, bool approved)"
], signer);

// Approve marketplace (one-time per collection)
await nft.setApprovalForAll(
  "0x9cDB207D834c1c5FE3b1777fC360eC4473f5A38B",
  true,
  { gasLimit: 100000 }
);

// List the NFT
const marketplace = new ethers.Contract(
  "0x9cDB207D834c1c5FE3b1777fC360eC4473f5A38B",
  [
    "function list(address nftContract, uint256 tokenId, uint256 price)",
    "function buy(address nftContract, uint256 tokenId) payable",
    "function cancelListing(address nftContract, uint256 tokenId)",
    "function getListing(address nftContract, uint256 tokenId) view returns (tuple(address,address,uint256,uint256,bool))"
  ],
  signer
);

await marketplace.list(
  collectionAddress,
  1, // tokenId
  ethers.parseEther("0.05"), // price in RITUAL
  { gasLimit: 200000 }
);
```

### Buy a Listed NFT

```javascript
const listing = await marketplace.getListing(collectionAddress, 1);
// listing: [seller, nftContract, tokenId, price, active]

await marketplace.buy(
  collectionAddress,
  1, // tokenId
  { value: listing.price, gasLimit: 300000 }
);
```

### Cancel a Listing

```javascript
await marketplace.cancelListing(
  collectionAddress,
  1, // tokenId
  { gasLimit: 100000 }
);
```

---

## 5. Collection Management (Owner Only)

### Update Base URI (metadata reveal)

```javascript
// Ensure your contract instance includes these management ABIs:
const collection = new ethers.Contract(collectionAddress, [
  "function setBaseURI(string baseURI_)",
  "function setPhaseTime(uint256 phaseId, uint64 start, uint64 end)",
  "function addPhase(tuple(uint64,uint64,uint128,uint32,bytes32,bool) phase)",
  "function setMerkleRoot(uint256 phaseId, bytes32 root)",
  "function setRoyalty(address receiver, uint96 fee)",
  "function withdraw()",
  "function owner() view returns (address)"
], signer);

await collection.setBaseURI("ipfs://QmNewRevealedCID/", { gasLimit: 100000 });
```

### Update Phase Timing

```javascript
const newStart = Date.now(); // milliseconds
const newEnd = Date.now() + 86400000;
await collection.setPhaseTime(0, newStart, newEnd, { gasLimit: 100000 });
```

### Add a New Mint Phase

```javascript
const now = Date.now();
await collection.addPhase({
  startTime: now,
  endTime: now + 86400000,
  price: ethers.parseEther("0.005"),
  maxPerWallet: 10,
  merkleRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
  isPublic: true
}, { gasLimit: 150000 });
```

### Withdraw Collected Mint Funds

```javascript
await collection.withdraw({ gasLimit: 100000 });
```

---

## 6. Read-Only Queries

### Get All Collections

```javascript
const factory = new ethers.Contract(
  "0xCeD6f5eA4b8e9D448fF732Ef44267D6cbD9F750f", // NFTFactory
  [
    "function getAllCollections() view returns (address[])",
    "function getCollectionsByOwner(address) view returns (address[])",
    "function totalCollections() view returns (uint256)"
  ],
  provider
);

const all = await factory.getAllCollections();
const mine = await factory.getCollectionsByOwner(myAddress);
```

### Get Collection Info

```javascript
const collection = new ethers.Contract(collectionAddress, [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function maxSupply() view returns (uint256)",
  "function totalMinted() view returns (uint256)",
  "function totalPhases() view returns (uint256)",
  "function getPhase(uint256) view returns (tuple(uint64,uint64,uint128,uint32,bytes32,bool))",
  "function baseURI() view returns (string)",
  "function owner() view returns (address)",
  "function royaltyInfo(uint256,uint256) view returns (address,uint256)"
], provider);

const name = await collection.name();
const minted = await collection.totalMinted();
const supply = await collection.maxSupply();
const phase0 = await collection.getPhase(0);
```

### Check Listing Status

```javascript
const listing = await marketplace.getListing(collectionAddress, tokenId);
const isActive = listing.active;
const price = listing.price;
```

---

## 7. IPFS Metadata Format

The Cauldron uses standard ERC-721 metadata stored on IPFS.

### Single-Image Collection

Set `baseURI` to the raw IPFS CID of the image:
```
ipfs://QmSingleImageCID
```

### Multi-Token Collection

Set `baseURI` to a folder with trailing slash:
```
ipfs://QmFolderCID/
```

Each token's metadata is at `{baseURI}{tokenId}` and should follow:

```json
{
  "name": "Ritual Spirit #1",
  "description": "A spirit born from the Ritual Chain.",
  "image": "ipfs://QmImageCID",
  "attributes": [
    { "trait_type": "Element", "value": "Fire" },
    { "trait_type": "Rarity", "value": "Legendary" }
  ]
}
```

---

## 8. Backend API (Optional)

The Cauldron has an indexing backend for faster queries:

| Endpoint | Method | Description |
|---|---|---|
| `/collections` | GET | All indexed collections |
| `/collections/:address` | GET | Collection details |
| `/collections/:address/tokens` | GET | All tokens in a collection |
| `/listings` | GET | Active marketplace listings (query: `?seller=0x...&limit=50&offset=0`) |
| `/merkle/generate` | POST | Generate Merkle root from `{ addresses: string[] }` or `{ csv: string }` |
| `/merkle/:root/:address` | GET | Get Merkle proof for a wallet against a given root |

**Base URL:** Configured via `NEXT_PUBLIC_API_URL` in `frontend/.env.local` (default: `http://localhost:3001`)

All core operations work directly on-chain without the backend. The backend is optional and provides faster indexed queries.

---

## 9. Common Agent Workflows

### Workflow A: Deploy and Launch a Collection

1. Upload art to IPFS (use Pinata or `ipfs add`)
2. Call `factory.createCollection(...)` with name, symbol, baseURI, supply, royalty, phases
3. Parse the `CollectionCreated` event for the new collection address
4. Generate Merkle tree from allowlist wallets
5. Call `collection.setMerkleRoot(phaseId, root)` to set the allowlist
6. Share the mint link: `https://the-cauldron.vercel.app/mint/{collectionAddress}`

### Workflow B: Manage an Existing Collection

1. Read current state: `collection.getPhase(0)`, `collection.totalMinted()`
2. Update allowlist: generate new Merkle root → `setMerkleRoot(phaseId, newRoot)`
3. Adjust timing: `setPhaseTime(phaseId, newStart, newEnd)` (milliseconds)
4. Add public phase: `addPhase({...isPublic: true})`
5. Reveal metadata: `setBaseURI("ipfs://QmRevealedCID/")`

### Workflow C: Trade NFTs

1. Check ownership: `nft.ownerOf(tokenId)`
2. Approve marketplace: `nft.setApprovalForAll(marketplaceAddress, true)`
3. List: `marketplace.list(nftContract, tokenId, price)`
4. Monitor: `marketplace.getListing(nftContract, tokenId)`
5. Cancel if needed: `marketplace.cancelListing(nftContract, tokenId)`

### Workflow D: Analyze a Collection

1. Get all collections: `factory.getAllCollections()`
2. For each: read `name()`, `totalMinted()`, `maxSupply()`, `totalPhases()`
3. Calculate mint progress: `totalMinted / maxSupply * 100`
4. Check phase status: compare `getPhase(i).startTime/endTime` with `Date.now()`
5. Report findings

---

## 10. Error Reference

| Error | Cause | Fix |
|---|---|---|
| `MaxSupplyExceeded` | Mint would exceed maxSupply | Reduce quantity |
| `PhaseNotActive` | Current time outside phase window | Check timestamps (milliseconds!) |
| `PhaseNotPublic` | Called publicMint on an allowlist phase | Use allowlistMint with proof |
| `InvalidProof` | Merkle proof doesn't match root | Regenerate proof for correct address |
| `WalletLimitExceeded` | Wallet already minted max for this phase | Check mintedPerWalletPerPhase |
| `InsufficientPayment` | msg.value < price × quantity | Send correct amount |
| `NotTokenOwner` | Trying to list NFT you don't own | Verify ownership first |
| `NotApproved` | Marketplace not approved to transfer | Call setApprovalForAll first |
| `AlreadyListed` | Token is already listed | Cancel existing listing first |
| `NotSeller` | Trying to cancel listing you didn't create | Only seller can cancel |

---

## Autonomous Cauldron Agent

When the user asks for an autonomous Cauldron agent, build a **disclosed Ritual-native agent**, not a hidden human impersonator.

### Agent Identity Rules

The agent must:
- **Clearly identify itself** as an autonomous agent in UI, prompts, logs, and outputs
- **Never claim to be human** or conceal its agent nature
- **Never bypass wallet policy** or execute hidden transactions
- If a user asks for "human-like" or "indistinguishable from human," interpret as: **high-agency, natural, autonomous, and capable** while preserving disclosure

### Agent Capabilities

The agent must be able to:
- **See** — Cauldron state: collections, listings, wallet NFTs, ownership, mint phases, approvals, prices, and wallet limits
- **Think** — with policy: spend ceiling, confidence threshold, allowed actions, verification status, wallet ownership, gas limits, and Ritual millisecond timestamps
- **Do** — reviewable on-chain actions: deploy collection, mint, buy, list, cancel listing, approve marketplace, set allowlist root, update metadata, or withdraw funds

### Agent Spend Enforcement

- Agent **MUST** check spend against policy ceiling **BEFORE** submitting any transaction
- Agent **MUST NOT** auto-approve transactions exceeding the configured max spend
- Default mode **MUST** be `supervised` (require human approval), not `autonomous`
- `dry-run` mode must be tested before enabling autonomous execution
- If the operator wallet balance drops below the minimum threshold, halt all autonomous actions

### Ritual Agent Infrastructure

| System Contract | Address | Purpose |
|---|---|---|
| **Sovereign Agent** (precompile) | `0x000000000000000000000000000000000000080C` | One-shot reasoning/jobs — best for MVP |
| **SovereignAgentFactory** | `0x9dC4C054e53bCc4Ce0A0Ff09E890A7a8e817f304` | Production launch — deploys deterministic agent harnesses |
| **Persistent Agent** (precompile) | `0x0000000000000000000000000000000000000820` | Long-lived identity/memory — for stateful agents |
| **Scheduler** | `0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B` | Recurring operations (e.g. auto-list, auto-buy) |
| **RitualWallet** | `0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948` | Fee management for agent compute |
| **TEEServiceRegistry** | `0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F` | Executor discovery for TEE-backed verification |
| **AsyncDelivery** | `0x5A16214fF555848411544b005f7Ac063742f39F6` | Callback router — `msg.sender` in callbacks |

### Required Build Flow

When building an autonomous Cauldron agent:

1. **Add `/agent` frontend route** with agent dashboard UI
2. **Add agent policy controls:**
   - Operator wallet address
   - Mode: `autonomous` / `supervised` / `dry-run`
   - Max spend per action (in RITUAL)
   - Min confidence threshold (0-100)
   - Action toggles: allow buy / list / cancel / mint / deploy
3. **Read Cauldron state** via backend API + on-chain contract reads:
   - `factory.getAllCollections()` — all collections
   - `collection.getPhase(i)` — mint phase status
   - `marketplace.getListing(contract, tokenId)` — listing status
   - `collection.mintedPerWalletPerPhase(phaseId, wallet)` — wallet limits
4. **Predict deterministic agent harness** with `SovereignAgentFactory` using `(owner, userSalt)`
5. **Discover a healthy executor** with `TEEServiceRegistry.getServicesByCapability(0, true)`
6. **Check RitualWallet funding:**
   - `balanceOf(operator)` — has enough to cover compute
   - `lockUntil(operator)` — not currently locked
7. **Require provider/model/DA/secrets** before autonomous scheduling
8. **Deploy harness** only from the operator wallet with explicit `gas: 3000000n`
9. **Keep all marketplace and mint actions wallet-controlled** unless the user explicitly enables autonomous execution policy

### Agent Architecture Tiers

| Tier | Use Case | Precompile | Complexity |
|---|---|---|---|
| **Tier 1: Sovereign** | One-shot tasks ("analyze this collection", "mint the cheapest NFT") | `0x080C` | Low — single tx, callback with result |
| **Tier 2: Factory-Backed** | Production agents with deterministic addresses | `SovereignAgentFactory` | Medium — deploy harness, then interact |
| **Tier 3: Persistent** | Long-lived agents with memory and identity | `0x0820` | High — stateful, requires agent key management |
| **Tier 4: Scheduled** | Recurring operations ("check floor price every hour") | Scheduler + Sovereign | High — combines scheduler with agent actions |

### Example: Sovereign Agent Call for Collection Analysis

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PrecompileConsumer} from "@anthropic/ritual-contracts/PrecompileConsumer.sol";

contract CauldronAgent is PrecompileConsumer {
    address public constant SOVEREIGN_AGENT = 0x000000000000000000000000000000000000080C;
    address public constant ASYNC_DELIVERY = 0x5A16214fF555848411544b005f7Ac063742f39F6;

    event AgentTaskSubmitted(bytes32 indexed taskId, string prompt);
    event AgentTaskCompleted(bytes32 indexed taskId, string result);

    modifier onlyAsyncDelivery() {
        require(msg.sender == ASYNC_DELIVERY, "Only AsyncDelivery");
        _;
    }

    function analyzeCollection(address collection) external {
        string memory prompt = string(abi.encodePacked(
            "Analyze the NFT collection at ", toHexString(collection),
            " on Ritual Chain. Report: name, total minted, max supply, ",
            "active phases, floor price from marketplace listings, ",
            "and a recommendation (buy/wait/skip)."
        ));

        bytes32 taskId = keccak256(abi.encodePacked(collection, block.timestamp));
        emit AgentTaskSubmitted(taskId, prompt);

        // Submit to Sovereign Agent precompile
        (bool success,) = SOVEREIGN_AGENT.call(
            abi.encodeWithSignature(
                "runAgent(string,bytes)",
                prompt,
                abi.encode(taskId)
            )
        );
        require(success, "Agent submission failed");
    }

    function handleCallback(bytes32 taskId, string calldata result) 
        external onlyAsyncDelivery 
    {
        emit AgentTaskCompleted(taskId, result);
        // Process result: update on-chain state, trigger actions, etc.
    }
}
```

### Ritual Skill References

For deeper agent integration, load these Ritual skills:

| Feature | Skill File |
|---|---|
| Agent execution (Sovereign/Persistent) | `skills/ritual-dapp-agents/SKILL.md` |
| Precompile ABI reference | `skills/ritual-dapp-precompiles/SKILL.md` |
| Scheduling | `skills/ritual-dapp-scheduler/SKILL.md` |
| Fee management | `skills/ritual-dapp-wallet/SKILL.md` |
| Secrets & encryption | `skills/ritual-dapp-secrets/SKILL.md` |
| Chain architecture & async lifecycle | `skills/ritual-dapp-overview/SKILL.md` |
| Consumer contract patterns | `skills/ritual-dapp-contracts/SKILL.md` |

---

## Important Notes

1. **Timestamps are in MILLISECONDS** on Ritual Chain, not seconds. Always use `Date.now()` (not `Math.floor(Date.now() / 1000)`).
2. **Legacy transactions are recommended.** Set `type: 0` or omit the type field for maximum compatibility. EIP-1559 works with ethers.js but may fail with some tooling (Hardhat deployer).
3. **Token IDs start at 1**, not 0 (ERC721A with `_startTokenId() = 1`).
4. **Royalty max is 10%** (1000 basis points). Values above 1000 will revert with `RoyaltyTooHigh`.
5. **The marketplace is escrow-less.** NFTs stay in the seller's wallet until purchased. The seller must keep their approval active.
6. **Platform fee** is deducted from the sale price along with royalties. The seller receives the remainder.

---

## Agent Safety Rules

1. **Never use second-based timestamps on Ritual Chain.** Always use `Date.now()` or millisecond values for mint phase `startTime`/`endTime`. Dividing by 1000 will create phases that expired decades ago.
2. **Use explicit gas limits for every transaction:**
   - Collection creation: `500000`
   - Minting: `200000`
   - Marketplace operations: `300000`
   - Admin functions (setMerkleRoot, setBaseURI, etc.): `100000`
3. **Treat `0x` + 64 hex characters as a private key**, not a wallet address. Addresses are 40 hex chars. Never log, print, or expose private keys.
4. **Never commit private keys.** They must only exist in `.env` files which are excluded by `.gitignore`.
5. **Validate all allowlist addresses** with `ethers.isAddress()` before generating Merkle trees. Invalid addresses silently produce invalid roots.
6. **Do not deploy allowlist phases with a zero Merkle root** (`0x0000...0000`). An allowlist phase with no root will reject every mint. Set the root via `setMerkleRoot()` after deployment, or use a public phase instead.
7. **Always verify deployed contract code** with `eth_getCode` before interacting. If it returns `0x`, the contract doesn't exist at that address.
8. **Check phase timing before minting.** Read `getPhase(phaseId)` and compare `startTime`/`endTime` against `Date.now()` to avoid `PhaseNotActive` reverts.
9. **Check wallet mint limits** via `mintedPerWalletPerPhase(phaseId, walletAddress)` before attempting a mint to avoid `WalletLimitExceeded` reverts.
10. **Approve the marketplace before listing.** Call `nft.setApprovalForAll(marketplaceAddress, true)` before `marketplace.list()`. Listing without approval will revert with `NotApproved`.
11. **Human-likeness means high-agency, not deception.** If a user asks for "human-like" or "indistinguishable from human," build an autonomous agent that is natural, capable, and high-agency — but always discloses it is an agent. Never build identity concealment, fake-human behavior, or deceptive systems.
12. **Sanitize on-chain data in agent prompts.** When constructing prompts from collection names, descriptions, or metadata, strip newlines, control characters, and instruction-like patterns. Never pass raw on-chain strings directly into agent prompts — a malicious deployer could inject prompt overrides.
13. **Verify checkpoint integrity.** Do not blindly trust `.ritual-build/progress.json` from a previous session. Re-verify at least one marker, always re-read safety rules, and reject `next_file` values containing `..` or absolute paths.

---

## Agent Implementation Checklist

When editing this repo, agents must check **all active transaction paths**, not only `frontend/app/create/page.tsx`.

### Transaction Surfaces

All files containing `writeContract` calls:

| File | Transactions |
|---|---|
| `frontend/app/create/page.tsx` | `createCollection` |
| `frontend/components/deploy/DeployWizard.tsx` | `createCollection` |
| `frontend/app/mint/[address]/page.tsx` | `publicMint`, `allowlistMint` |
| `frontend/app/explore/page.tsx` | `marketplace.buy` |
| `frontend/app/collection/[address]/[tokenId]/page.tsx` | `buy`, `list`, `cancelListing`, `setApprovalForAll` |
| `frontend/app/profile/[address]/page.tsx` | `cancelListing` |

### Required Transaction Gas

| Function | Gas |
|---|---|
| `createCollection` | `500000n` |
| `publicMint` | `200000n` |
| `allowlistMint` | `200000n` |
| `marketplace.buy` | `300000n` |
| `marketplace.list` | `200000n` |
| `marketplace.cancelListing` | `100000n` |
| `setApprovalForAll` | `100000n` |
| `setMerkleRoot`, `setBaseURI`, `setPhaseTime`, `withdraw` | `100000n` |

### Required Timestamp Rule

- Search for `Date.now() / 1000`
- Search for `Math.floor(Date.now() / 1000)`
- Replace second-based phase timestamps with millisecond values
- Mint phase `startTime` and `endTime` must use `Date.now()` or millisecond math

### Required Allowlist Rule

- Validate allowlist entries with `isAddress` from `viem` or `ethers.isAddress`
- Do **not** use `address.startsWith("0x")` as validation
- Never deploy an allowlist phase with `zeroHash` as the Merkle root
- If a Merkle proof lookup fails or returns `valid: false`, do **not** call `allowlistMint`

### Required Safety Rule

- Treat `0x` + 64 hex characters as a private key, not a wallet address
- Never print it back
- Never use it unless it is explicitly placed in a local `.env` file by the user

### Required Verification

- Check chain ID is `1979`
- Check bytecode exists at:
  - `0xCeD6f5eA4b8e9D448fF732Ef44267D6cbD9F750f` (Factory)
  - `0x9cDB207D834c1c5FE3b1777fC360eC4473f5A38B` (Marketplace)
  - `0xBCea72054CEd720c797501fdA3Eb07866C12d67b` (Implementation)
- Run build/test commands if `npm`, `npx`, and `cast` are available
- If they are unavailable, say exactly which commands were blocked
