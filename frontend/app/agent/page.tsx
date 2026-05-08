"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  type AgentStrategy,
  type AgentMode,
  DEFAULT_STRATEGY,
  calculateFunding,
  buildPrompt,
  AGENT_SKILL_URL,
} from "@/lib/agent-factory";
import { MARKETPLACE_ADDRESS } from "@/lib/contracts";
import {
  useExecutorDiscovery,
  useDeployAgent,
  useSenderLock,
  useMyAgents,
} from "@/hooks/useAgentFactory";

const MODES: { id: AgentMode; label: string; icon: string; desc: string }[] = [
  { id: "scout", label: "Scout", icon: "\u25A3", desc: "One-shot task. Runs once, returns result." },
  { id: "operator", label: "Operator", icon: "\u21C4", desc: "Recurring. Checks market on a schedule." },
  { id: "sentinel", label: "Sentinel", icon: "\u229E", desc: "Always-on portfolio manager with memory." },
];

const PROVIDERS = [
  { id: "ritual", label: "Ritual (no key needed)", model: "zai-org/GLM-4.7-FP8" },
  { id: "anthropic", label: "Anthropic", model: "claude-sonnet-4-5-20250929" },
  { id: "openai", label: "OpenAI", model: "gpt-4o" },
  { id: "gemini", label: "Gemini", model: "gemini-2.5-flash" },
] as const;

function formatRitual(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(4);
}

export default function AgentPage() {
  const { address, isConnected } = useAccount();
  const { executor, executorCount, isLoading: executorLoading } = useExecutorDiscovery();
  const { isLocked } = useSenderLock();
  const { deploy, status, txHash, isConfirming, isSuccess, isFailed, error, reset } = useDeployAgent();
  const { agents, refresh } = useMyAgents();

  const [strategy, setStrategy] = useState<AgentStrategy>(DEFAULT_STRATEGY);
  const [collectionInput, setCollectionInput] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);

  const funding = calculateFunding(strategy);

  useEffect(() => { if (isSuccess) refresh(); }, [isSuccess, refresh]);

  const handleDeploy = () => {
    if (!isConnected) return;
    deploy(strategy);
  };

  const addCollection = () => {
    const addr = collectionInput.trim();
    if (addr.startsWith("0x") && addr.length === 42 && !strategy.collections.includes(addr as `0x${string}`)) {
      setStrategy(s => ({ ...s, collections: [...s.collections, addr as `0x${string}`] }));
      setCollectionInput("");
    }
  };

  const removeCollection = (addr: `0x${string}`) => {
    setStrategy(s => ({ ...s, collections: s.collections.filter(c => c !== addr) }));
  };

  const canDeploy = isConnected && !isLocked && executor && status === "idle";

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
          style={{ background: "rgba(255,29,206,0.1)", border: "1px solid rgba(255,29,206,0.2)", color: "#FF1DCE" }}>
          <span>{"\u25C7"}</span> NATIVE RITUAL AGENT
        </div>
        <h1 className="text-4xl font-black mb-3 gradient-text">Your Autonomous Agent</h1>
        <p className="text-sm" style={{ color: "rgba(200,247,197,0.5)", maxWidth: 500, margin: "0 auto" }}>
          Deploy an autonomous NFT agent directly on Ritual Chain.
          Runs in TEE. No Python. No hot wallet. One MetaMask transaction.
        </p>
      </div>

      {/* Skill File Reference */}
      <div className="glass-card p-4 mb-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold"
            style={{ background: "rgba(255,29,206,0.1)", color: "#FF1DCE" }}>{"\u2630"}</div>
          <div>
            <div className="font-semibold" style={{ color: "rgba(200,247,197,0.6)" }}>Agent Skill File</div>
            <div style={{ color: "rgba(200,247,197,0.3)", fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}>AGENT_SKILL.md — teaches the TEE executor how to trade on The Cauldron</div>
          </div>
        </div>
        <a href={AGENT_SKILL_URL} target="_blank" rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg font-semibold transition-all"
          style={{ border: "1px solid rgba(255,29,206,0.15)", color: "#FF1DCE", fontSize: 10 }}>
          View Skill
        </a>
      </div>

      {/* Executor Status */}
      <div className="glass-card p-4 mb-6 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{
            background: executor ? "#19D184" : executorLoading ? "#FACC15" : "#EF4444",
            boxShadow: executor ? "0 0 8px rgba(25,209,132,0.4)" : "none",
          }} />
          <span style={{ color: "rgba(200,247,197,0.5)" }}>
            {executorLoading ? "Discovering executors..." :
              executor ? `${executorCount} TEE executor${executorCount !== 1 ? "s" : ""} available` :
                "No executors found"}
          </span>
        </div>
        {isLocked && (
          <span style={{ color: "#FACC15" }}>Sender locked — wait for pending job</span>
        )}
      </div>

      {!isConnected ? (
        <div className="glass-card p-12 text-center">
          <p className="text-sm mb-4" style={{ color: "rgba(200,247,197,0.5)" }}>Connect your wallet to deploy an agent</p>
          <ConnectButton />
        </div>
      ) : (
        <>
          {/* Mode Selector */}
          <div className="glass-card p-6 mb-4">
            <label className="text-xs font-semibold tracking-wider uppercase mb-3 block"
              style={{ color: "rgba(200,247,197,0.4)" }}>Agent Mode</label>
            <div className="grid grid-cols-3 gap-3">
              {MODES.map(m => (
                <button key={m.id} onClick={() => setStrategy(s => ({ ...s, mode: m.id }))}
                  className="p-4 rounded-xl text-left transition-all"
                  style={{
                    background: strategy.mode === m.id ? "rgba(200,247,197,0.08)" : "rgba(200,247,197,0.02)",
                    border: `1px solid ${strategy.mode === m.id ? "rgba(200,247,197,0.2)" : "rgba(200,247,197,0.06)"}`,
                  }}>
                  <div className="text-lg mb-1" style={{ color: "#FF1DCE" }}>{m.icon}</div>
                  <div className="text-sm font-bold" style={{ color: "var(--mint)" }}>{m.label}</div>
                  <div className="text-xs mt-1" style={{ color: "rgba(200,247,197,0.35)" }}>{m.desc}</div>
                  {m.id !== "scout" && (
                    <div className="text-[10px] mt-2 px-2 py-0.5 rounded-full inline-block"
                      style={{ background: "rgba(250,204,21,0.1)", color: "#FACC15" }}>
                      {m.id === "sentinel" ? "Coming Soon" : "Phase 2"}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Strategy */}
          <div className="glass-card p-6 mb-4">
            <label className="text-xs font-semibold tracking-wider uppercase mb-4 block"
              style={{ color: "rgba(200,247,197,0.4)" }}>Strategy</label>

            {/* Collections */}
            <div className="mb-4">
              <label className="text-xs mb-1 block" style={{ color: "rgba(200,247,197,0.5)" }}>
                Target Collections <span style={{ color: "rgba(200,247,197,0.25)" }}>(leave empty for all)</span>
              </label>
              <div className="flex gap-2">
                <input value={collectionInput} onChange={e => setCollectionInput(e.target.value)}
                  placeholder="0x..." onKeyDown={e => e.key === "Enter" && addCollection()}
                  className="flex-1 px-3 py-2 rounded-lg text-xs"
                  style={{ background: "rgba(200,247,197,0.04)", border: "1px solid rgba(200,247,197,0.08)",
                    color: "var(--mint)", fontFamily: "JetBrains Mono, monospace" }} />
                <button onClick={addCollection} className="px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ border: "1px solid rgba(200,247,197,0.15)", color: "var(--mint)" }}>Add</button>
              </div>
              {strategy.collections.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {strategy.collections.map(c => (
                    <span key={c} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]"
                      style={{ background: "rgba(200,247,197,0.06)", fontFamily: "JetBrains Mono, monospace",
                        color: "rgba(200,247,197,0.6)" }}>
                      {c.slice(0, 6)}...{c.slice(-4)}
                      <button onClick={() => removeCollection(c)} className="ml-1 opacity-50 hover:opacity-100">{"\u2715"}</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Price + Budget */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs mb-1 block" style={{ color: "rgba(200,247,197,0.5)" }}>Max Price / NFT</label>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.01" min="0"
                    value={Number(strategy.maxPricePerNFT) / 1e18}
                    onChange={e => setStrategy(s => ({ ...s, maxPricePerNFT: BigInt(Math.floor(Number(e.target.value) * 1e18)) }))}
                    className="flex-1 px-3 py-2 rounded-lg text-xs"
                    style={{ background: "rgba(200,247,197,0.04)", border: "1px solid rgba(200,247,197,0.08)", color: "var(--mint)" }} />
                  <span className="text-xs" style={{ color: "rgba(200,247,197,0.3)" }}>RITUAL</span>
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "rgba(200,247,197,0.5)" }}>Total Budget</label>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.1" min="0"
                    value={Number(strategy.totalBudget) / 1e18}
                    onChange={e => setStrategy(s => ({ ...s, totalBudget: BigInt(Math.floor(Number(e.target.value) * 1e18)) }))}
                    className="flex-1 px-3 py-2 rounded-lg text-xs"
                    style={{ background: "rgba(200,247,197,0.04)", border: "1px solid rgba(200,247,197,0.08)", color: "var(--mint)" }} />
                  <span className="text-xs" style={{ color: "rgba(200,247,197,0.3)" }}>RITUAL</span>
                </div>
              </div>
            </div>

            {/* Execution Mode */}
            <div className="mb-4">
              <label className="text-xs mb-2 block" style={{ color: "rgba(200,247,197,0.5)" }}>Execution Mode</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { v: true, label: "Autonomous", desc: "Agent executes trades automatically" },
                  { v: false, label: "Supervised", desc: "Agent recommends, you approve" },
                ].map(opt => (
                  <button key={String(opt.v)} onClick={() => setStrategy(s => ({ ...s, autonomous: opt.v }))}
                    className="p-3 rounded-xl text-left"
                    style={{
                      background: strategy.autonomous === opt.v ? "rgba(200,247,197,0.08)" : "rgba(200,247,197,0.02)",
                      border: `1px solid ${strategy.autonomous === opt.v ? "rgba(25,209,132,0.3)" : "rgba(200,247,197,0.06)"}`,
                    }}>
                    <div className="text-xs font-bold" style={{ color: "var(--mint)" }}>{opt.label}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: "rgba(200,247,197,0.35)" }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-List */}
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={strategy.autoList} id="autolist"
                onChange={e => setStrategy(s => ({ ...s, autoList: e.target.checked }))}
                className="w-4 h-4 rounded" style={{ accentColor: "var(--mint)" }} />
              <label htmlFor="autolist" className="text-xs" style={{ color: "rgba(200,247,197,0.5)" }}>
                Auto-list NFTs above
              </label>
              <input type="number" step="0.1" min="1" value={strategy.autoListMultiplier}
                onChange={e => setStrategy(s => ({ ...s, autoListMultiplier: Number(e.target.value) }))}
                disabled={!strategy.autoList}
                className="w-16 px-2 py-1 rounded-lg text-xs text-center"
                style={{ background: "rgba(200,247,197,0.04)", border: "1px solid rgba(200,247,197,0.08)",
                  color: "var(--mint)", opacity: strategy.autoList ? 1 : 0.3 }} />
              <span className="text-xs" style={{ color: "rgba(200,247,197,0.3)" }}>x purchase price</span>
            </div>
          </div>

          {/* AI Model */}
          <div className="glass-card p-6 mb-4">
            <label className="text-xs font-semibold tracking-wider uppercase mb-4 block"
              style={{ color: "rgba(200,247,197,0.4)" }}>AI Model</label>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {PROVIDERS.map(p => (
                <button key={p.id} onClick={() => setStrategy(s => ({ ...s, llmProvider: p.id as AgentStrategy["llmProvider"], model: p.model }))}
                  className="p-3 rounded-xl text-left"
                  style={{
                    background: strategy.llmProvider === p.id ? "rgba(255,29,206,0.06)" : "rgba(200,247,197,0.02)",
                    border: `1px solid ${strategy.llmProvider === p.id ? "rgba(255,29,206,0.2)" : "rgba(200,247,197,0.06)"}`,
                  }}>
                  <div className="text-xs font-bold" style={{ color: strategy.llmProvider === p.id ? "#FF1DCE" : "var(--mint)" }}>{p.label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "rgba(200,247,197,0.3)", fontFamily: "JetBrains Mono, monospace" }}>{p.model}</div>
                </button>
              ))}
            </div>
            {strategy.llmProvider !== "ritual" && (
              <div>
                <label className="text-xs mb-1 block" style={{ color: "rgba(200,247,197,0.5)" }}>API Key (encrypted before submission)</label>
                <input type="password" value={strategy.apiKey}
                  onChange={e => setStrategy(s => ({ ...s, apiKey: e.target.value }))}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 rounded-lg text-xs"
                  style={{ background: "rgba(200,247,197,0.04)", border: "1px solid rgba(200,247,197,0.08)",
                    color: "var(--mint)", fontFamily: "JetBrains Mono, monospace" }} />
                <p className="text-[10px] mt-1" style={{ color: "rgba(200,247,197,0.25)" }}>
                  ECIES encrypted to executor public key. Never stored in plaintext.
                </p>
              </div>
            )}
          </div>

          {/* Funding Breakdown */}
          <div className="glass-card p-6 mb-4">
            <label className="text-xs font-semibold tracking-wider uppercase mb-3 block"
              style={{ color: "rgba(200,247,197,0.4)" }}>Estimated Funding</label>
            <div className="space-y-2 text-xs" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              {[
                ["Execution fees", formatRitual(funding.executionFees)],
                ["Trading budget", formatRitual(funding.tradingBudget)],
                ["Buffer (20%)", formatRitual(funding.buffer)],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between" style={{ color: "rgba(200,247,197,0.5)" }}>
                  <span>{label}</span>
                  <span>{val} RITUAL</span>
                </div>
              ))}
              <div className="pt-2 mt-2 flex justify-between font-bold"
                style={{ borderTop: "1px solid rgba(200,247,197,0.08)", color: "#BFFF00" }}>
                <span>Total deposit</span>
                <span>{formatRitual(funding.total)} RITUAL</span>
              </div>
            </div>
          </div>

          {/* Preview Prompt */}
          <div className="mb-4">
            <button onClick={() => setShowPrompt(!showPrompt)}
              className="text-xs flex items-center gap-1"
              style={{ color: "rgba(200,247,197,0.3)" }}>
              {showPrompt ? "\u25BC" : "\u25B6"} Preview agent prompt
            </button>
            {showPrompt && (
              <div className="mt-2 p-4 rounded-xl text-[11px] whitespace-pre-wrap"
                style={{ background: "rgba(200,247,197,0.03)", border: "1px solid rgba(200,247,197,0.06)",
                  fontFamily: "JetBrains Mono, monospace", color: "rgba(200,247,197,0.5)", lineHeight: 1.6 }}>
                {buildPrompt(strategy, MARKETPLACE_ADDRESS)}
              </div>
            )}
          </div>

          {/* Deploy Button */}
          <button onClick={handleDeploy} disabled={!canDeploy}
            className="w-full py-4 rounded-xl text-sm font-bold transition-all"
            style={{
              background: canDeploy ? "rgba(25,209,132,0.1)" : "rgba(200,247,197,0.03)",
              border: `1px solid ${canDeploy ? "rgba(25,209,132,0.3)" : "rgba(200,247,197,0.06)"}`,
              color: canDeploy ? "#19D184" : "rgba(200,247,197,0.2)",
              cursor: canDeploy ? "pointer" : "not-allowed",
            }}>
            {status === "idle" ? `Deploy ${strategy.mode.charAt(0).toUpperCase() + strategy.mode.slice(1)} Agent` :
              status === "deploying" ? "Deploying..." :
              status === "confirming" ? "Confirming..." :
              status === "success" ? "\u2713 Agent Deployed" :
              status === "error" ? "Failed — Try Again" :
              "Processing..."}
          </button>

          {/* Status Messages */}
          {error && (
            <div className="mt-3 p-3 rounded-xl text-xs" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444" }}>
              {error}
            </div>
          )}
          {txHash && (
            <div className="mt-3 p-3 rounded-xl text-xs" style={{ background: "rgba(25,209,132,0.05)", border: "1px solid rgba(25,209,132,0.15)" }}>
              <span style={{ color: "rgba(200,247,197,0.4)" }}>TX: </span>
              <a href={`https://explorer.ritualfoundation.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                style={{ color: "#19D184", fontFamily: "JetBrains Mono, monospace" }}>
                {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </a>
            </div>
          )}

          {/* Active Agents */}
          {agents.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-bold mb-4" style={{ color: "var(--mint)" }}>Active Agents</h2>
              <div className="space-y-3">
                {agents.map((agent, i) => (
                  <div key={i} className="glass-card p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: "#19D184", boxShadow: "0 0 8px rgba(25,209,132,0.4)" }} />
                        <span className="text-sm font-bold" style={{ color: "var(--mint)" }}>
                          {(agent.strategy as Record<string, string>)?.mode?.charAt(0).toUpperCase()}{(agent.strategy as Record<string, string>)?.mode?.slice(1)} Agent
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(25,209,132,0.1)", color: "#19D184" }}>
                        {agent.status as string}
                      </span>
                    </div>
                    <div className="text-xs" style={{ fontFamily: "JetBrains Mono, monospace", color: "rgba(200,247,197,0.4)" }}>
                      TX: {(agent.txHash as string)?.slice(0, 10)}...{(agent.txHash as string)?.slice(-8)}
                    </div>
                    <div className="text-[10px] mt-1" style={{ color: "rgba(200,247,197,0.25)" }}>
                      Deployed {new Date(agent.deployedAt as number).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
