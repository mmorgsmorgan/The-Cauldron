# RitualPad — AI Forge Launchpad

The primary NFT infrastructure on **Ritual Chain** (Chain ID: 1979).

Deploy collections → Mint with allowlists → Trade with royalties → View your entire chain-wide portfolio.

---

## Architecture

```
ritualpad/
├── contracts/     # Solidity smart contracts (Hardhat)
│   ├── src/
│   │   ├── AIRitualNFT.sol        # ERC721A collection with multi-phase minting
│   │   ├── NFTFactory.sol         # EIP-1167 clone factory
│   │   └── RitualMarketplace.sol  # Escrow-less marketplace with ERC-2981 royalties
│   ├── test/                      # Full test suite
│   └── scripts/deploy.ts         # Deployment script
├── backend/       # Fastify API + Chain-wide Indexer
│   ├── src/
│   │   ├── indexer/     # Transfer event listener + metadata fetcher
│   │   ├── routes/      # REST API endpoints
│   │   ├── services/    # Merkle tree service
│   │   └── db/          # PostgreSQL schema + queries
│   └── Dockerfile
├── frontend/      # Next.js 14 App Router
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── create/page.tsx       # 3-step collection deployment wizard
│   │   ├── explore/page.tsx      # Marketplace browse
│   │   ├── profile/[address]/    # Chain-wide portfolio (KEY PAGE)
│   │   └── collection/[address]/ # Collection detail + mint
│   ├── components/
│   │   ├── nft/         # NFTCard (4 render states), NFTGrid
│   │   └── layout/      # Navbar with RainbowKit
│   ├── hooks/           # React Query hooks
│   └── lib/             # Wagmi config, API client, ABIs
└── docker-compose.yml   # PostgreSQL + backend
```

## Quick Start

### 1. Smart Contracts
```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
# Deploy (when you have test tokens):
# npx hardhat run scripts/deploy.ts --network ritual
```

### 2. Database
```bash
docker compose up postgres -d
cd backend && npm install
npx tsx src/db/init.ts
```

### 3. Backend + Indexer
```bash
cd backend
cp .env.example .env  # Edit with your contract addresses
npm run dev
```

### 4. Frontend
```bash
cd frontend
npm install
cp .env.example .env.local  # Edit with your API URL + contract addresses
npm run dev
```

## Key Features

- **ERC-721A** — Gas-efficient batch minting (up to 90% savings)
- **EIP-1167 Clones** — ~10x cheaper collection deployments
- **Merkle Proofs** — Scalable allowlist verification
- **ERC-2981** — On-chain royalty enforcement
- **Chain-Wide Indexer** — See ALL NFTs on Ritual, not just platform-deployed
- **3 NFT Render States** — Full metadata → Broken → Unrevealed (graceful degradation)

## Ritual Chain

| Property | Value |
|----------|-------|
| Chain ID | 1979 |
| RPC | https://rpc.ritualfoundation.org |
| Explorer | https://explorer.ritualfoundation.org |
| Currency | RITUAL |

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/user/:address/nfts` | Chain-wide portfolio |
| GET | `/collections` | All collections |
| GET | `/collections/:address` | Collection detail |
| GET | `/listings` | Active marketplace listings |
| POST | `/merkle/generate` | Generate Merkle root from addresses |
| GET | `/merkle/:root/:address` | Get proof for address |
| GET | `/health` | Health check |
