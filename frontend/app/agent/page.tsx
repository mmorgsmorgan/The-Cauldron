"use client";

export default function AgentPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-center">
      {/* Pro Mode Banner */}
      <a href="/agent/pro" className="block glass-card p-5 mb-8 text-left group transition-all"
        style={{ borderColor: "rgba(255,29,206,0.15)" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-[10px] font-semibold mb-2"
              style={{ background: "rgba(255,29,206,0.1)", border: "1px solid rgba(255,29,206,0.2)", color: "#FF1DCE" }}>
              {"\u25C7"} NEW
            </div>
            <div className="text-sm font-bold" style={{ color: "var(--mint)" }}>
              Pro Mode — Native Ritual Agent
            </div>
            <div className="text-xs mt-1" style={{ color: "rgba(200,247,197,0.4)" }}>
              Deploy on-chain. Runs in TEE. No Python, no hot wallet. One MetaMask transaction.
            </div>
          </div>
          <div className="text-lg transition-transform group-hover:translate-x-1" style={{ color: "rgba(200,247,197,0.3)" }}>{"\u2192"}</div>
        </div>
      </a>

      <h1 className="text-4xl font-black mb-4 gradient-text">Local Agent (Tier 1)</h1>
      <p className="text-lg mb-10" style={{ color: "rgba(200,247,197,0.6)" }}>
        Your AI agent reads SKILL.md, learns the platform, and trades NFTs on your behalf.
        Run locally with full control over execution.
      </p>

      {/* Step 1 */}
      <div className="glass-card p-8 text-left mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-black" style={{ color: "var(--mint)", opacity: 0.3 }}>01</span>
          <h2 className="font-black text-xl" style={{ color: "var(--mint)" }}>Agent Reads SKILL.md</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: "rgba(200,247,197,0.5)" }}>
          Your AI agent reads the skill file from GitHub. It learns every contract address,
          every function, every gas limit, and every API endpoint. No repo cloning needed.
        </p>
        <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(200,247,197,0.04)", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.8, color: "rgba(200,247,197,0.7)" }}>
          <span style={{ color: "rgba(200,247,197,0.3)" }}>Skill file URL:</span><br/>
          https://raw.githubusercontent.com/mmorgsmorgan/The-Cauldron/main/SKILL.md<br/><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}>Tell your agent:</span><br/>
          &quot;Read this skill and activate it for my wallet&quot;
        </div>
      </div>

      {/* Step 2 */}
      <div className="glass-card p-8 text-left mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-black" style={{ color: "var(--mint)", opacity: 0.3 }}>02</span>
          <h2 className="font-black text-xl" style={{ color: "var(--mint)" }}>Create a Hot Wallet</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: "rgba(200,247,197,0.5)" }}>
          Create a dedicated wallet for your agent. Never use your main wallet.
          This wallet will own the agent contract and sign all transactions.
        </p>
        <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(200,247,197,0.04)", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.8, color: "rgba(200,247,197,0.7)" }}>
          <span style={{ color: "rgba(200,247,197,0.3)" }}>MetaMask: Create Account, copy private key</span><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}>Fund it with enough for gas + trading:</span><br/><br/>
          cast send 0xNewHotWallet \<br/>
          {"  "}--value 0.1ether \<br/>
          {"  "}--rpc-url https://rpc.ritualfoundation.org \<br/>
          {"  "}--private-key $YOUR_MAIN_KEY
        </div>
      </div>

      {/* Step 3 */}
      <div className="glass-card p-8 text-left mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-black" style={{ color: "var(--mint)", opacity: 0.3 }}>03</span>
          <h2 className="font-black text-xl" style={{ color: "var(--mint)" }}>Deploy Your Agent Contract</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: "rgba(200,247,197,0.5)" }}>
          Connect the hot wallet in MetaMask, then deploy.
          The hot wallet becomes the contract owner with full execution rights,
          bounded by the policy you set.
        </p>
        <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(200,247,197,0.04)", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.8, color: "rgba(200,247,197,0.7)" }}>
          python3 agent/agent.py --deploy<br/><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}>Open http://localhost:8888</span><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}>Connect hot wallet in MetaMask</span><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}>Click Deploy, note the contract address</span>
        </div>
      </div>

      {/* Step 4 */}
      <div className="glass-card p-8 text-left mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-black" style={{ color: "var(--mint)", opacity: 0.3 }}>04</span>
          <h2 className="font-black text-xl" style={{ color: "var(--mint)" }}>Start Autonomous Mode</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: "rgba(200,247,197,0.5)" }}>
          Give the agent your hot wallet key. It signs and sends transactions autonomously.
          Talk to it in chat to buy, sell, and list NFTs.
        </p>
        <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(200,247,197,0.04)", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.8, color: "rgba(200,247,197,0.7)" }}>
          pip install web3<br/><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}>Use env var (safer than CLI flag)</span><br/>
          export AGENT_HOT_KEY=0xHotWalletPrivateKey<br/>
          python3 agent/agent.py --address 0xYourAgent<br/><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}>Dashboard: http://localhost:8888</span>
        </div>
      </div>

      {/* API */}
      <div className="glass-card p-8 text-left mb-6">
        <h2 className="font-black text-xl mb-2" style={{ color: "var(--mint)" }}>Execution API</h2>
        <p className="text-sm mb-4" style={{ color: "rgba(200,247,197,0.5)" }}>
          Your agent exposes these endpoints. Tell it what to do in chat — it calls them automatically.
        </p>
        <div className="space-y-2">
          {[
            ["POST /api/buy", "Buy an NFT"],
            ["POST /api/list", "List for sale"],
            ["POST /api/cancel", "Cancel listing"],
            ["GET /api/info", "Agent status and balance"],
          ].map(([endpoint, desc]) => (
            <div key={endpoint} className="flex gap-3 p-3 rounded-lg text-xs" style={{ background: "rgba(200,247,197,0.04)" }}>
              <code className="font-bold whitespace-nowrap" style={{ color: "var(--mint)", minWidth: "140px" }}>{endpoint}</code>
              <span style={{ color: "rgba(200,247,197,0.4)" }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="glass-card p-8 text-left">
        <h2 className="font-black text-xl mb-4" style={{ color: "var(--mint)" }}>How It Works</h2>
        <div className="space-y-3 text-sm" style={{ color: "rgba(200,247,197,0.55)" }}>
          {[
            ["You chat", "Tell your agent what to do in natural language"],
            ["Agent reads SKILL.md", "Learns capabilities, contracts, and chain config from the skill file"],
            ["Agent executes", "Calls the local API, signs with hot wallet, sends to Ritual Chain"],
            ["Contract enforces policy", "Spend ceiling, permissions, and mode are checked on-chain"],
            ["You monitor", "Dashboard shows balance, actions, policy — all on-chain and auditable"],
          ].map(([title, desc]) => (
            <div key={title} className="flex gap-3 items-start">
              <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: "var(--mint)" }} />
              <div>
                <div className="font-bold" style={{ color: "var(--mint)" }}>{title}</div>
                <div style={{ color: "rgba(200,247,197,0.4)" }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
