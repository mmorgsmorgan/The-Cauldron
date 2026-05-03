"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, parseEther } from "viem";

// ── CauldronAgent ABI (subset for dashboard) ──
const AGENT_ABI = [
  {
    name: "getAgentInfo",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "identity", type: "string" },
      { name: "mode", type: "uint8" },
      { name: "spendCeiling", type: "uint256" },
      { name: "allowBuy", type: "bool" },
      { name: "allowList", type: "bool" },
      { name: "allowCancel", type: "bool" },
      { name: "minConfidence", type: "uint8" },
      { name: "balance", type: "uint256" },
      { name: "spent", type: "uint256" },
      { name: "executed", type: "uint256" },
    ],
  },
  {
    name: "getBalance",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getPendingQueueLength",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "setPolicy",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "mode", type: "uint8" },
      { name: "spendCeiling", type: "uint256" },
      { name: "maxListPrice", type: "uint256" },
      { name: "allowBuy", type: "bool" },
      { name: "allowList", type: "bool" },
      { name: "allowCancel", type: "bool" },
      { name: "minConfidence", type: "uint8" },
    ],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
  },
  {
    name: "requestDecision",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "currentPrice", type: "uint256" },
      { name: "context", type: "string" },
    ],
    outputs: [{ name: "taskId", type: "bytes32" }],
  },
  {
    name: "directBuy",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
    ],
  },
] as const;

// ── Agent address — update after deployment ──
const AGENT_ADDRESS = process.env.NEXT_PUBLIC_AGENT_ADDRESS as `0x${string}` | undefined;
const MODE_LABELS = ["SUPERVISED", "AUTONOMOUS", "DRY_RUN"] as const;
const MODE_COLORS = ["rgba(255,200,50,0.8)", "rgba(100,255,150,0.8)", "rgba(150,150,255,0.8)"];
const MODE_BG = ["rgba(255,200,50,0.08)", "rgba(100,255,150,0.08)", "rgba(150,150,255,0.08)"];

export default function AgentPage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<"status" | "policy" | "actions">("status");

  // ── Policy form state ──
  const [policyMode, setPolicyMode] = useState(0);
  const [spendCeiling, setSpendCeiling] = useState("0.1");
  const [maxListPrice, setMaxListPrice] = useState("100");
  const [allowBuy, setAllowBuy] = useState(true);
  const [allowList, setAllowList] = useState(true);
  const [allowCancel, setAllowCancel] = useState(true);
  const [minConfidence, setMinConfidence] = useState(70);

  // ── Action form state ──
  const [actionNft, setActionNft] = useState("");
  const [actionTokenId, setActionTokenId] = useState("");
  const [actionPrice, setActionPrice] = useState("");
  const [actionContext, setActionContext] = useState("");

  // ── Contract reads ──
  const agentInfo = useReadContract({
    address: AGENT_ADDRESS,
    abi: AGENT_ABI,
    functionName: "getAgentInfo",
    query: { enabled: !!AGENT_ADDRESS, refetchInterval: 5000 },
  });

  const owner = useReadContract({
    address: AGENT_ADDRESS,
    abi: AGENT_ABI,
    functionName: "owner",
    query: { enabled: !!AGENT_ADDRESS },
  });

  const pendingQueue = useReadContract({
    address: AGENT_ADDRESS,
    abi: AGENT_ABI,
    functionName: "getPendingQueueLength",
    query: { enabled: !!AGENT_ADDRESS, refetchInterval: 5000 },
  });

  // ── Contract writes ──
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const isOwner = owner.data && address && owner.data.toLowerCase() === address.toLowerCase();

  // Sync policy form with on-chain data
  useEffect(() => {
    if (agentInfo.data) {
      setPolicyMode(Number(agentInfo.data[1]));
      setSpendCeiling(formatEther(agentInfo.data[2]));
      setAllowBuy(agentInfo.data[3]);
      setAllowList(agentInfo.data[4]);
      setAllowCancel(agentInfo.data[5]);
      setMinConfidence(Number(agentInfo.data[6]));
    }
  }, [agentInfo.data]);

  function handleSetPolicy() {
    if (!AGENT_ADDRESS) return;
    writeContract({
      address: AGENT_ADDRESS,
      abi: AGENT_ABI,
      functionName: "setPolicy",
      args: [
        policyMode,
        parseEther(spendCeiling),
        parseEther(maxListPrice),
        allowBuy,
        allowList,
        allowCancel,
        minConfidence,
      ],
      gas: 100000n,
    });
  }

  function handleRequestDecision() {
    if (!AGENT_ADDRESS || !actionNft) return;
    writeContract({
      address: AGENT_ADDRESS,
      abi: AGENT_ABI,
      functionName: "requestDecision",
      args: [
        actionNft as `0x${string}`,
        BigInt(actionTokenId || "0"),
        parseEther(actionPrice || "0"),
        actionContext || "Analyze this NFT for trading opportunity",
      ],
      gas: 500000n,
    });
  }

  // ── Not deployed yet state ──
  if (!AGENT_ADDRESS) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center">
          <div className="text-6xl mb-6">🤖</div>
          <h1 className="text-4xl font-black mb-4 gradient-text">CauldronAgent</h1>
          <p className="text-muted text-lg mb-8 max-w-xl mx-auto">
            The autonomous NFT trading agent is compiled and ready.
            Deploy it to Ritual Chain to activate this dashboard.
          </p>
          <div className="glass-card p-8 text-left max-w-lg mx-auto">
            <h3 className="font-bold mb-4" style={{ color: "var(--mint)" }}>Deploy Instructions</h3>
            <div className="space-y-3 text-sm" style={{ color: "rgba(200,247,197,0.6)" }}>
              <div className="p-3 rounded-xl" style={{ background: "rgba(200,247,197,0.04)", fontFamily: "JetBrains Mono" }}>
                cd contracts<br />
                npx hardhat run scripts/deploy-agent.ts --network ritual
              </div>
              <p>Then set the agent address in Vercel:</p>
              <div className="p-3 rounded-xl" style={{ background: "rgba(200,247,197,0.04)", fontFamily: "JetBrains Mono" }}>
                NEXT_PUBLIC_AGENT_ADDRESS=0x...
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading state ──
  if (agentInfo.isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🤖</div>
          <p className="text-muted">Loading agent state from Ritual Chain...</p>
        </div>
      </div>
    );
  }

  const info = agentInfo.data;
  const currentMode = info ? Number(info[1]) : 0;
  const balance = info ? info[7] : 0n;
  const totalSpent = info ? info[8] : 0n;
  const actionsCount = info ? Number(info[9]) : 0;
  const queueLen = pendingQueue.data ? Number(pendingQueue.data) : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">🤖</span>
            <h1 className="text-3xl font-black gradient-text">CauldronAgent</h1>
          </div>
          <p className="text-muted text-sm">
            Autonomous NFT agent on Ritual Chain &bull; All actions on-chain &amp; auditable
          </p>
        </div>

        {/* Mode badge */}
        <div
          className="px-5 py-2.5 rounded-2xl font-black text-sm tracking-wider"
          style={{
            background: MODE_BG[currentMode],
            color: MODE_COLORS[currentMode],
            border: `1px solid ${MODE_COLORS[currentMode]}`,
          }}
        >
          {MODE_LABELS[currentMode]}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Balance" value={`${Number(formatEther(balance)).toFixed(4)} RITUAL`} icon="💰" />
        <StatCard label="Total Spent" value={`${Number(formatEther(totalSpent)).toFixed(4)} RITUAL`} icon="📉" />
        <StatCard label="Actions Executed" value={actionsCount.toString()} icon="⚡" />
        <StatCard label="Pending Queue" value={queueLen.toString()} icon="📋" highlight={queueLen > 0} />
      </div>

      {/* Address info */}
      <div className="glass-card p-5 mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">Agent Contract:</span>
          <a
            href={`https://explorer.ritualfoundation.org/address/${AGENT_ADDRESS}`}
            target="_blank"
            className="font-mono text-sm font-bold"
            style={{ color: "var(--mint)" }}
          >
            {AGENT_ADDRESS?.slice(0, 10)}...{AGENT_ADDRESS?.slice(-8)}
          </a>
        </div>
        <div className="flex items-center gap-2">
          {isOwner ? (
            <span className="badge-verified">OWNER</span>
          ) : (
            <span className="badge-external">VIEW ONLY</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        {(["status", "policy", "actions"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200"
            style={{
              background: activeTab === tab ? "rgba(200,247,197,0.12)" : "transparent",
              color: activeTab === tab ? "var(--mint)" : "rgba(200,247,197,0.4)",
              border: `1px solid ${activeTab === tab ? "rgba(200,247,197,0.2)" : "rgba(200,247,197,0.06)"}`,
            }}
          >
            {tab === "status" && "📊 Status"}
            {tab === "policy" && "⚙️ Policy"}
            {tab === "actions" && "🎯 Actions"}
          </button>
        ))}
      </div>

      {/* Status Tab */}
      {activeTab === "status" && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-bold text-lg mb-4" style={{ color: "var(--mint)" }}>Agent Identity</h3>
            <p className="text-sm" style={{ color: "rgba(200,247,197,0.6)", fontFamily: "JetBrains Mono", lineHeight: 1.8 }}>
              {info ? info[0] : "Loading..."}
            </p>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-bold text-lg mb-4" style={{ color: "var(--mint)" }}>Current Policy</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <PolicyItem label="Spend Ceiling" value={info ? `${Number(formatEther(info[2])).toFixed(4)} RITUAL` : "..."} />
              <PolicyItem label="Allow Buy" value={info ? (info[3] ? "Yes" : "No") : "..."} positive={info?.[3]} />
              <PolicyItem label="Allow List" value={info ? (info[4] ? "Yes" : "No") : "..."} positive={info?.[4]} />
              <PolicyItem label="Allow Cancel" value={info ? (info[5] ? "Yes" : "No") : "..."} positive={info?.[5]} />
              <PolicyItem label="Min Confidence" value={info ? `${info[6]}%` : "..."} />
              <PolicyItem label="Mode" value={MODE_LABELS[currentMode]} />
            </div>
          </div>

          {isOwner && (
            <div className="glass-card p-6">
              <h3 className="font-bold text-lg mb-4" style={{ color: "var(--mint)" }}>Fund Agent</h3>
              <p className="text-sm text-muted mb-4">Send RITUAL directly to the agent contract address to fund buy operations.</p>
              <div className="p-3 rounded-xl" style={{ background: "rgba(200,247,197,0.04)", fontFamily: "JetBrains Mono", fontSize: 13 }}>
                {AGENT_ADDRESS}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Policy Tab */}
      {activeTab === "policy" && (
        <div className="glass-card p-6">
          <h3 className="font-bold text-lg mb-6" style={{ color: "var(--mint)" }}>Update Policy</h3>

          {!isOwner ? (
            <p className="text-muted">Only the owner can update the agent policy.</p>
          ) : (
            <div className="space-y-5">
              {/* Mode selector */}
              <div>
                <label className="text-sm font-bold text-muted block mb-2">Execution Mode</label>
                <div className="flex gap-3">
                  {MODE_LABELS.map((label, i) => (
                    <button
                      key={label}
                      onClick={() => setPolicyMode(i)}
                      className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: policyMode === i ? MODE_BG[i] : "transparent",
                        color: policyMode === i ? MODE_COLORS[i] : "rgba(200,247,197,0.3)",
                        border: `1px solid ${policyMode === i ? MODE_COLORS[i] : "rgba(200,247,197,0.08)"}`,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Spend ceiling */}
              <div>
                <label className="text-sm font-bold text-muted block mb-2">Spend Ceiling (RITUAL)</label>
                <input
                  className="input-field"
                  type="number"
                  step="0.01"
                  value={spendCeiling}
                  onChange={(e) => setSpendCeiling(e.target.value)}
                  placeholder="0.1"
                />
              </div>

              {/* Max list price */}
              <div>
                <label className="text-sm font-bold text-muted block mb-2">Max List Price (RITUAL)</label>
                <input
                  className="input-field"
                  type="number"
                  step="0.01"
                  value={maxListPrice}
                  onChange={(e) => setMaxListPrice(e.target.value)}
                  placeholder="100"
                />
              </div>

              {/* Confidence */}
              <div>
                <label className="text-sm font-bold text-muted block mb-2">Min Confidence: {minConfidence}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))}
                  className="w-full accent-[#c8f7c5]"
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-3 gap-4">
                <Toggle label="Allow Buy" checked={allowBuy} onChange={setAllowBuy} />
                <Toggle label="Allow List" checked={allowList} onChange={setAllowList} />
                <Toggle label="Allow Cancel" checked={allowCancel} onChange={setAllowCancel} />
              </div>

              <button
                onClick={handleSetPolicy}
                disabled={isPending || isConfirming}
                className="btn-primary w-full"
              >
                {isPending ? "Confirm in wallet..." : isConfirming ? "Updating policy..." : "Update Policy"}
              </button>

              {isSuccess && (
                <p className="text-sm text-center" style={{ color: "rgba(100,255,150,0.8)" }}>
                  Policy updated successfully!
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions Tab */}
      {activeTab === "actions" && (
        <div className="space-y-6">
          {/* Request Decision */}
          <div className="glass-card p-6">
            <h3 className="font-bold text-lg mb-4" style={{ color: "var(--mint)" }}>🧠 Request AI Decision</h3>
            <p className="text-sm text-muted mb-4">
              Send market context to the Sovereign Agent precompile for AI-powered trading decisions.
            </p>

            {!isOwner ? (
              <p className="text-muted">Only the owner can request decisions.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-muted block mb-2">NFT Contract Address</label>
                  <input
                    className="input-field"
                    value={actionNft}
                    onChange={(e) => setActionNft(e.target.value)}
                    placeholder="0x..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-muted block mb-2">Token ID</label>
                    <input
                      className="input-field"
                      value={actionTokenId}
                      onChange={(e) => setActionTokenId(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-muted block mb-2">Current Price (RITUAL)</label>
                    <input
                      className="input-field"
                      value={actionPrice}
                      onChange={(e) => setActionPrice(e.target.value)}
                      placeholder="0.05"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-muted block mb-2">Context / Instructions</label>
                  <textarea
                    className="input-field"
                    rows={3}
                    value={actionContext}
                    onChange={(e) => setActionContext(e.target.value)}
                    placeholder="e.g. Floor price dropped 20%, consider buying"
                    style={{ resize: "vertical" }}
                  />
                </div>
                <button
                  onClick={handleRequestDecision}
                  disabled={isPending || isConfirming || !actionNft}
                  className="btn-primary w-full"
                >
                  {isPending ? "Confirm in wallet..." : isConfirming ? "Submitting to precompile..." : "🧠 Request Decision"}
                </button>
              </div>
            )}
          </div>

          {/* Pending queue info */}
          <div className="glass-card p-6">
            <h3 className="font-bold text-lg mb-4" style={{ color: "var(--mint)" }}>📋 Pending Actions</h3>
            {queueLen === 0 ? (
              <p className="text-muted text-sm">No pending actions. Request a decision above or switch to AUTONOMOUS mode.</p>
            ) : (
              <p className="text-sm" style={{ color: "rgba(255,200,50,0.8)" }}>
                {queueLen} action{queueLen > 1 ? "s" : ""} pending owner approval.
                Use the contract directly to approve/reject.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Transaction status toast */}
      {(isPending || isConfirming) && (
        <div
          className="fixed bottom-6 right-6 px-5 py-3 rounded-2xl text-sm font-bold animate-pulse z-50"
          style={{ background: "rgba(200,247,197,0.12)", color: "var(--mint)", border: "1px solid rgba(200,247,197,0.2)" }}
        >
          {isPending ? "⏳ Waiting for wallet..." : "⛓️ Confirming on-chain..."}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function StatCard({ label, value, icon, highlight }: { label: string; value: string; icon: string; highlight?: boolean }) {
  return (
    <div
      className="glass-card p-5"
      style={highlight ? { borderColor: "rgba(255,200,50,0.3)", boxShadow: "0 0 20px rgba(255,200,50,0.05)" } : undefined}
    >
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <span className="text-xs font-bold text-muted uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-black" style={{ color: "var(--mint)" }}>{value}</p>
    </div>
  );
}

function PolicyItem({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="p-3 rounded-xl" style={{ background: "rgba(200,247,197,0.04)" }}>
      <p className="text-xs text-muted mb-1">{label}</p>
      <p
        className="font-bold text-sm"
        style={{ color: positive === true ? "rgba(100,255,150,0.8)" : positive === false ? "rgba(255,120,120,0.7)" : "var(--mint)" }}
      >
        {value}
      </p>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="p-3 rounded-xl text-sm font-bold text-left transition-all"
      style={{
        background: checked ? "rgba(100,255,150,0.06)" : "rgba(255,120,120,0.04)",
        color: checked ? "rgba(100,255,150,0.8)" : "rgba(255,120,120,0.6)",
        border: `1px solid ${checked ? "rgba(100,255,150,0.15)" : "rgba(255,120,120,0.1)"}`,
      }}
    >
      {checked ? "✓ " : "✕ "}{label}
    </button>
  );
}
