/**
 * Agent Factory — Sovereign Agent integration for The Cauldron Pro Mode.
 * Uses SovereignAgentFactory (0x9dC4...7304) to deploy agent harnesses.
 */

// ── System Addresses ──
export const SOVEREIGN_FACTORY = "0x9dC4C054e53bCc4Ce0A0Ff09E890A7a8e817f304" as const;
export const PERSISTENT_FACTORY = "0xD4AA9D55215dc8149Af57605e70921Ea16b73591" as const;
export const TEE_SERVICE_REGISTRY = "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F" as const;
export const RITUAL_WALLET = "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948" as const;
export const ASYNC_JOB_TRACKER = "0xC069FFCa0389f44eCA2C626e55491b0ab045AEF5" as const;

// ── Agent Modes ──
export type AgentMode = "scout" | "operator" | "sentinel";

// ── Strategy Config ──
export interface AgentStrategy {
  mode: AgentMode;
  collections: `0x${string}`[];
  maxPricePerNFT: bigint;
  totalBudget: bigint;
  autoList: boolean;
  autoListMultiplier: number;
  autonomous: boolean;
  llmProvider: "anthropic" | "openai" | "gemini" | "ritual";
  model: string;
  apiKey: string; // plaintext — encrypted before on-chain submission
  frequency: number;      // blocks between calls (default: 2000)
  windowNumCalls: number; // calls per window (default: 5)
}

// ── Default Strategy ──
export const DEFAULT_STRATEGY: AgentStrategy = {
  mode: "scout",
  collections: [],
  maxPricePerNFT: 50000000000000000n, // 0.05 RITUAL
  totalBudget: 500000000000000000n,    // 0.5 RITUAL
  autoList: false,
  autoListMultiplier: 2.0,
  autonomous: true,
  llmProvider: "ritual",
  model: "zai-org/GLM-4.7-FP8",
  apiKey: "",
  frequency: 2000,
  windowNumCalls: 5,
};

// ── Funding Calculator ──
export function calculateFunding(strategy: AgentStrategy): {
  executionFees: bigint;
  tradingBudget: bigint;
  buffer: bigint;
  total: bigint;
} {
  const GAS_PER_EXECUTION = 3_000_000n;
  const GAS_PRICE = 1_000_000_007n;
  const COST_PER_CALL = GAS_PER_EXECUTION * GAS_PRICE;

  const baseCalls = strategy.mode === "scout" ? 1n : BigInt(strategy.windowNumCalls);
  const executionFees = baseCalls * COST_PER_CALL;
  const buffer = (executionFees * 20n) / 100n;
  const tradingBudget = strategy.totalBudget;

  return {
    executionFees,
    tradingBudget,
    buffer,
    total: executionFees + tradingBudget + buffer,
  };
}

// ── Prompt Builder ──
export function buildPrompt(strategy: AgentStrategy, marketplaceAddress: string): string {
  const collectionClause = strategy.collections.length === 0
    ? "Scan ALL active marketplace listings."
    : `Focus on these collections: ${strategy.collections.join(", ")}`;

  const autoListClause = strategy.autoList
    ? `\n- Auto-list: YES. List any NFT you hold above ${strategy.autoListMultiplier}x its purchase price.`
    : "\n- Auto-list: NO. Do not list any NFTs.";

  const modeClause = strategy.autonomous
    ? "You are in AUTONOMOUS mode. Execute actions directly."
    : "You are in SUPERVISED mode. Return recommendations only — do not execute.";

  return `You are an autonomous NFT trading agent on The Cauldron marketplace (Ritual Chain, ID 1979).

MARKETPLACE CONTRACT: ${marketplaceAddress}

STRATEGY:
- Mode: ${strategy.mode}
- ${collectionClause}
- Max price per NFT: ${formatRitual(strategy.maxPricePerNFT)} RITUAL
- Total budget: ${formatRitual(strategy.totalBudget)} RITUAL${autoListClause}
- ${modeClause}

INSTRUCTIONS:
1. Query the marketplace for active listings
2. Filter for NFTs matching your strategy constraints
3. If a buy opportunity exists and price <= max price: execute buy(nftContract, tokenId)
4. If you hold NFTs above auto-list threshold: execute list(nftContract, tokenId, price)
5. If no action needed: return HOLD with brief reasoning

RULES:
- Never exceed max price per NFT
- Never exceed total budget
- Never buy from your own listings
- Always verify listing is still active before buying
- Report every decision with reasoning`;
}

function formatRitual(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  return eth.toFixed(4);
}

// ── TEEServiceRegistry ABI (executor discovery) ──
export const TEE_REGISTRY_ABI = [
  {
    name: "getServicesByCapability",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "capability", type: "uint8" },
      { name: "checkValidity", type: "bool" },
    ],
    outputs: [{
      name: "",
      type: "tuple[]",
      components: [
        {
          name: "node", type: "tuple",
          components: [
            { name: "paymentAddress", type: "address" },
            { name: "teeAddress", type: "address" },
            { name: "teeType", type: "uint8" },
            { name: "publicKey", type: "bytes" },
            { name: "endpoint", type: "string" },
            { name: "certPubKeyHash", type: "bytes32" },
            { name: "capability", type: "uint8" },
          ],
        },
        { name: "isValid", type: "bool" },
        { name: "workloadId", type: "bytes32" },
      ],
    }],
  },
] as const;

// ── SovereignAgentFactory ABI (deploy) ──
export const SOVEREIGN_FACTORY_ABI = [
  {
    name: "predictHarness",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "userSalt", type: "bytes32" },
    ],
    outputs: [
      { name: "harness", type: "address" },
      { name: "childSalt", type: "bytes32" },
    ],
  },
  {
    name: "deployHarness",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "userSalt", type: "bytes32" }],
    outputs: [{ name: "harness", type: "address" }],
  },
] as const;

// ── AsyncJobTracker ABI (status tracking) ──
export const ASYNC_JOB_TRACKER_ABI = [
  {
    type: "event", name: "JobAdded",
    inputs: [
      { name: "executor", type: "address", indexed: true },
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "precompileAddress", type: "address", indexed: true },
      { name: "commitBlock", type: "uint256", indexed: false },
      { name: "precompileInput", type: "bytes", indexed: false },
      { name: "senderAddress", type: "address", indexed: false },
      { name: "previousBlockHash", type: "bytes32", indexed: false },
      { name: "previousBlockNumber", type: "uint256", indexed: false },
      { name: "previousBlockTimestamp", type: "uint256", indexed: false },
      { name: "ttl", type: "uint256", indexed: false },
      { name: "createdAt", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "ResultDelivered",
    inputs: [
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "target", type: "address", indexed: true },
      { name: "success", type: "bool", indexed: false },
    ],
  },
  {
    type: "event", name: "JobRemoved",
    inputs: [
      { name: "executor", type: "address", indexed: true },
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "completed", type: "bool", indexed: true },
    ],
  },
  {
    type: "function", name: "hasPendingJobForSender",
    inputs: [{ name: "sender", type: "address" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
] as const;

// ── RitualWallet ABI ──
export const RITUAL_WALLET_ABI = [
  {
    type: "function", name: "balanceOf",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "deposit",
    inputs: [{ name: "lockDuration", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
] as const;
