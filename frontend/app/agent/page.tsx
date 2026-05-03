"use client";

export default function AgentPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <div className="text-6xl mb-6">🤖</div>
      <h1 className="text-4xl font-black mb-4 gradient-text">CauldronAgent</h1>
      <p className="text-lg mb-10" style={{ color: "rgba(200,247,197,0.6)" }}>
        The agent runs its own local interface — lightweight, self-sovereign, no Node.js required.
      </p>

      <div className="glass-card p-8 text-left mb-6">
        <h2 className="font-black text-xl mb-4" style={{ color: "var(--mint)" }}>
          Run Your Agent Locally
        </h2>
        <p className="text-sm mb-4" style={{ color: "rgba(200,247,197,0.5)" }}>
          Python 3 only — no npm, no build step, no Node.js.
        </p>
        <div className="space-y-3">
          <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(200,247,197,0.04)", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.8, color: "rgba(200,247,197,0.7)" }}>
            <span style={{ color: "rgba(200,247,197,0.3)" }}># 1. Clone or navigate to the agent folder</span><br/>
            cd ritualpad/agent<br/><br/>
            <span style={{ color: "rgba(200,247,197,0.3)" }}># 2. Run with your deployed agent address</span><br/>
            python3 agent.py --address 0xYourAgentAddress<br/><br/>
            <span style={{ color: "rgba(200,247,197,0.3)" }}># 3. Open in browser</span><br/>
            open http://localhost:8888
          </div>
        </div>
      </div>

      <div className="glass-card p-8 text-left mb-6">
        <h2 className="font-black text-xl mb-4" style={{ color: "var(--mint)" }}>
          Deploy the Agent Contract First
        </h2>
        <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(200,247,197,0.04)", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.8, color: "rgba(200,247,197,0.7)" }}>
          cd ritualpad/contracts<br/>
          npx hardhat run scripts/deploy-agent.ts --network ritual
        </div>
        <p className="text-sm mt-3" style={{ color: "rgba(200,247,197,0.4)" }}>
          Copy the deployed address → use it as <code>--address</code> when starting the agent.
        </p>
      </div>

      <div className="glass-card p-8 text-left">
        <h2 className="font-black text-xl mb-4" style={{ color: "var(--mint)" }}>How It Works</h2>
        <div className="space-y-3 text-sm" style={{ color: "rgba(200,247,197,0.55)" }}>
          {[
            ["🧠", "Agent reads SKILL.md from GitHub", "Learns its capabilities, contracts, and Ritual Chain config"],
            ["🖥️", "Agent generates its own UI", "Tailored single-page dashboard based on loaded skills"],
            ["⚡", "Agent serves locally via Python", "No Node.js, no build step — stdlib HTTP server only"],
            ["🔑", "You connect MetaMask", "One-time identity step — then agent takes full control"],
            ["🤖", "Agent executes autonomously", "Buy, list, cancel, request AI decisions — all on-chain"],
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
