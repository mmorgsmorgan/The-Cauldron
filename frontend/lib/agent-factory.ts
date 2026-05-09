/**
 * Agent Factory — Sovereign Agent integration for The Cauldron.
 * Built from ritual-dapp-agents SKILL.md (factory-backed, two-step deploy).
 *
 * Flow: deployHarness(salt) → configureFundAndStart(params, schedule, rolling, lockDuration)
 */

// ── System Addresses ──
export const SOVEREIGN_FACTORY = "0x9dC4C054e53bCc4Ce0A0Ff09E890A7a8e817f304" as const;
export const PERSISTENT_FACTORY = "0xD4AA9D55215dc8149Af57605e70921Ea16b73591" as const;
export const TEE_SERVICE_REGISTRY = "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F" as const;
export const RITUAL_WALLET = "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948" as const;
export const ASYNC_JOB_TRACKER = "0xC069FFCa0389f44eCA2C626e55491b0ab045AEF5" as const;
export const ASYNC_DELIVERY = "0x5A16214fF555848411544b005f7Ac063742f39F6" as const;
export const SCHEDULER = "0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B" as const;

// ── Agent Skill File ──
export const AGENT_SKILL_URL = "https://raw.githubusercontent.com/mmorgsmorgan/The-Cauldron/main/AGENT_SKILL.md" as const;

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
  apiKey: string;
  frequency: number;
  windowNumCalls: number;
}

// ── Default Strategy ──
export const DEFAULT_STRATEGY: AgentStrategy = {
  mode: "scout",
  collections: [],
  maxPricePerNFT: 50000000000000000n,
  totalBudget: 500000000000000000n,
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
  schedulerFunding: bigint;
  total: bigint;
} {
  const GAS_PER_EXECUTION = 3_000_000n;
  const GAS_PRICE = 1_000_000_007n;
  const COST_PER_CALL = GAS_PER_EXECUTION * GAS_PRICE;

  const baseCalls = strategy.mode === "scout" ? 1n : BigInt(strategy.windowNumCalls);
  const executionFees = baseCalls * COST_PER_CALL;
  // Scheduler needs funding deposited into harness RitualWallet
  const schedulerFunding = executionFees * 2n; // 2x for safety
  const buffer = (executionFees * 20n) / 100n;
  const tradingBudget = strategy.totalBudget;

  return {
    executionFees,
    tradingBudget,
    buffer,
    schedulerFunding,
    total: executionFees + tradingBudget + buffer + schedulerFunding,
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
  return (Number(wei) / 1e18).toFixed(4);
}

// ═══════════════════════════════════════════════════
// ABIs — sourced from ritual-dapp-agents SKILL.md
// ═══════════════════════════════════════════════════

// ── Shared struct components ──
const StorageRefComponents = [
  { name: "platform", type: "string" },
  { name: "path", type: "string" },
  { name: "keyRef", type: "string" },
] as const;

const SovereignAgentParamsComponents = [
  { name: "executor", type: "address" },
  { name: "ttl", type: "uint256" },
  { name: "userPublicKey", type: "bytes" },
  { name: "pollIntervalBlocks", type: "uint64" },
  { name: "maxPollBlock", type: "uint64" },
  { name: "taskIdMarker", type: "string" },
  { name: "deliveryTarget", type: "address" },
  { name: "deliverySelector", type: "bytes4" },
  { name: "deliveryGasLimit", type: "uint256" },
  { name: "deliveryMaxFeePerGas", type: "uint256" },
  { name: "deliveryMaxPriorityFeePerGas", type: "uint256" },
  { name: "cliType", type: "uint16" },
  { name: "prompt", type: "string" },
  { name: "encryptedSecrets", type: "bytes" },
  { name: "convoHistory", type: "tuple", components: StorageRefComponents },
  { name: "output", type: "tuple", components: StorageRefComponents },
  { name: "skills", type: "tuple[]", components: StorageRefComponents },
  { name: "systemPrompt", type: "tuple", components: StorageRefComponents },
  { name: "model", type: "string" },
  { name: "tools", type: "string[]" },
  { name: "maxTurns", type: "uint16" },
  { name: "maxTokens", type: "uint32" },
  { name: "rpcUrls", type: "string" },
] as const;

const SovereignScheduleConfigComponents = [
  { name: "schedulerGas", type: "uint32" },
  { name: "frequency", type: "uint32" },
  { name: "schedulerTtl", type: "uint32" },
  { name: "maxFeePerGas", type: "uint256" },
  { name: "maxPriorityFeePerGas", type: "uint256" },
  { name: "value", type: "uint256" },
] as const;

const SovereignRollingConfigComponents = [
  { name: "windowNumCalls", type: "uint32" },
  { name: "rolloverThresholdBps", type: "uint16" },
  { name: "rolloverRetryEveryCalls", type: "uint16" },
] as const;

// ── TEEServiceRegistry ABI ──
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

// ── SovereignAgentFactory ABI ──
export const SOVEREIGN_FACTORY_ABI = [
  {
    name: "deployHarness",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "userSalt", type: "bytes32" }],
    outputs: [{ name: "harness", type: "address" }],
  },
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
    name: "getDkmsDerivation",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "userSalt", type: "bytes32" },
    ],
    outputs: [
      { name: "dkmsOwner", type: "address" },
      { name: "keyIndex", type: "uint256" },
      { name: "keyFormat", type: "uint8" },
    ],
  },
] as const;

// ── SovereignAgentHarness ABI (child deployed by factory) ──
export const SOVEREIGN_HARNESS_ABI = [
  {
    name: "configureFundAndStart",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "params", type: "tuple", components: SovereignAgentParamsComponents },
      { name: "schedule", type: "tuple", components: SovereignScheduleConfigComponents },
      { name: "rolling", type: "tuple", components: SovereignRollingConfigComponents },
      { name: "schedulerLockDuration", type: "uint256" },
    ],
    outputs: [{ name: "schedulerCallId", type: "uint256" }],
  },
  {
    name: "onSovereignAgentResult",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "bytes32" },
      { name: "result", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "configured",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "stop",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "restart",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

// ── AsyncJobTracker ABI ──
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

// ── onSovereignAgentResult selector for deliverySelector ──
export const DELIVERY_SELECTOR = "0x8ca12055" as `0x${string}`;

// ── Build SovereignAgentParams from strategy ──
export function buildSovereignParams(
  strategy: AgentStrategy,
  executorAddress: `0x${string}`,
  harnessAddress: `0x${string}`,
  marketplaceAddress: `0x${string}`,
  encryptedSecrets: `0x${string}` = "0x",
) {
  const prompt = buildPrompt(strategy, marketplaceAddress);

  const emptyRef = { platform: "", path: "", keyRef: "" };
  const skillRef = {
    platform: "github",
    path: "mmorgsmorgan/The-Cauldron/main/AGENT_SKILL.md",
    keyRef: "",
  };

  return {
    executor: executorAddress,
    ttl: 500n,
    userPublicKey: "0x" as `0x${string}`,
    pollIntervalBlocks: 10n,
    maxPollBlock: 0n,
    taskIdMarker: "",
    deliveryTarget: harnessAddress,
    deliverySelector: DELIVERY_SELECTOR,
    deliveryGasLimit: 500_000n,
    deliveryMaxFeePerGas: 2_000_000_000n,
    deliveryMaxPriorityFeePerGas: 1_000_000_000n,
    cliType: 0,
    prompt,
    encryptedSecrets,
    convoHistory: emptyRef,
    output: emptyRef,
    skills: [skillRef],
    systemPrompt: emptyRef,
    model: strategy.model,
    tools: [] as string[],
    maxTurns: 5,
    maxTokens: 4096,
    rpcUrls: "https://rpc.ritualfoundation.org",
  };
}

// ── Build schedule config ──
export function buildScheduleConfig(strategy: AgentStrategy) {
  return {
    schedulerGas: 3_000_000,
    frequency: strategy.frequency,
    schedulerTtl: 500,
    maxFeePerGas: 2_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000n,
    value: 0n,
  };
}

// ── Build rolling config ──
export function buildRollingConfig(strategy: AgentStrategy) {
  return {
    windowNumCalls: strategy.windowNumCalls,
    rolloverThresholdBps: 5000,
    rolloverRetryEveryCalls: 1,
  };
}
