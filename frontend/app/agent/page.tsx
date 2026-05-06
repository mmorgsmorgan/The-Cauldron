"use client";

export default function AgentPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <div className="text-6xl mb-6">🤖</div>
      <h1 className="text-4xl font-black mb-4 gradient-text">Deploy Your Own Agent</h1>
      <p className="text-lg mb-10" style={{ color: "rgba(200,247,197,0.6)" }}>
        The Cauldron provides infrastructure for user-owned autonomous NFT agents.
        Deploy your own, run it locally, and let it trade on your behalf.
      </p>

      {/* Step 1 */}
      <div className="glass-card p-8 text-left mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-black" style={{ color: "var(--mint)", opacity: 0.3 }}>01</span>
          <h2 className="font-black text-xl" style={{ color: "var(--mint)" }}>Deploy Your Agent Contract</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: "rgba(200,247,197,0.5)" }}>
          Each user deploys their own <code>CauldronAgent.sol</code> to Ritual Chain.
          You own the contract. You control the policy. You hold the keys.
        </p>
        <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(200,247,197,0.04)", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.8, color: "rgba(200,247,197,0.7)" }}>
          <span style={{ color: "rgba(200,247,197,0.3)" }}># Clone the repo</span><br/>
          git clone https://github.com/mmorgsmorgan/The-Cauldron.git<br/>
          cd The-Cauldron/contracts<br/><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}># Set your deployer key</span><br/>
          echo &quot;DEPLOYER_PRIVATE_KEY=0xYourKey&quot; &gt; .env<br/><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}># Deploy your agent</span><br/>
          npx hardhat run scripts/deploy-agent.ts --network ritual
        </div>
      </div>

      {/* Step 2 */}
      <div className="glass-card p-8 text-left mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-black" style={{ color: "var(--mint)", opacity: 0.3 }}>02</span>
          <h2 className="font-black text-xl" style={{ color: "var(--mint)" }}>Run Your Agent Locally</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: "rgba(200,247,197,0.5)" }}>
          Python 3 only &mdash; no npm, no build step, no Node.js.
          Your agent reads SKILL.md, generates its own UI, and serves it locally.
        </p>
        <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(200,247,197,0.04)", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.8, color: "rgba(200,247,197,0.7)" }}>
          cd The-Cauldron/agent<br/>
          python3 agent.py --address 0xYourDeployedAgent<br/><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}># Open in browser</span><br/>
          open http://localhost:8888
        </div>
      </div>

      {/* Step 3 */}
      <div className="glass-card p-8 text-left mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-black" style={{ color: "var(--mint)", opacity: 0.3 }}>03</span>
          <h2 className="font-black text-xl" style={{ color: "var(--mint)" }}>Control Your Agent</h2>
        </div>
        <p className="text-sm" style={{ color: "rgba(200,247,197,0.5)" }}>
          Connect MetaMask → set policy → fund your agent → request AI decisions.
          Everything runs from your local dashboard. All actions are on-chain and auditable.
        </p>
      </div>

      {/* Architecture */}
      <div className="glass-card p-8 text-left">
        <h2 className="font-black text-xl mb-4" style={{ color: "var(--mint)" }}>Architecture</h2>
        <div className="space-y-3 text-sm" style={{ color: "rgba(200,247,197,0.55)" }}>
          {[
            ["🔑", "You deploy", "Your own CauldronAgent contract — you own it, you control it"],
            ["🧠", "Agent reads SKILL.md", "Learns its capabilities, contracts, and chain config"],
            ["🖥️", "Agent generates its UI", "Tailored dashboard served locally via Python stdlib"],
            ["🤖", "Agent executes on-chain", "Buy, list, cancel, AI decisions — all within your policy"],
            ["🔒", "Self-sovereign", "No central server. Your keys, your agent, your rules"],
          ].map(([icon, title, desc]) => (
            <div key={title} className="flex gap-3 items-start">
              <span className="text-xl">{icon}</span>
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
