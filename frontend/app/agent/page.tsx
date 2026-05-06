"use client";

export default function AgentPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <div className="text-6xl mb-6">🤖</div>
      <h1 className="text-4xl font-black mb-4 gradient-text">Your Autonomous Agent</h1>
      <p className="text-lg mb-10" style={{ color: "rgba(200,247,197,0.6)" }}>
        Deploy your own agent, give it a hot wallet, and let it trade NFTs autonomously.
        Talk to it in chat &mdash; it handles everything on-chain.
      </p>

      {/* Step 1 */}
      <div className="glass-card p-8 text-left mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-black" style={{ color: "var(--mint)", opacity: 0.3 }}>01</span>
          <h2 className="font-black text-xl" style={{ color: "var(--mint)" }}>Deploy Your Agent Contract</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: "rgba(200,247,197,0.5)" }}>
          One command starts a local deploy server. Connect MetaMask, click deploy, done.
        </p>
        <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(200,247,197,0.04)", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.8, color: "rgba(200,247,197,0.7)" }}>
          <span style={{ color: "rgba(200,247,197,0.3)" }}># Clone & deploy</span><br/>
          git clone https://github.com/mmorgsmorgan/The-Cauldron.git<br/>
          cd The-Cauldron<br/>
          python3 agent/agent.py --deploy<br/><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}># Open http://localhost:8888</span><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}># Connect MetaMask → Click Deploy</span><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}># Note your deployed agent address</span>
        </div>
      </div>

      {/* Step 2 */}
      <div className="glass-card p-8 text-left mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-black" style={{ color: "var(--mint)", opacity: 0.3 }}>02</span>
          <h2 className="font-black text-xl" style={{ color: "var(--mint)" }}>Create a Hot Wallet</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: "rgba(200,247,197,0.5)" }}>
          Never use your main wallet&apos;s key. Create a dedicated hot wallet and fund it with a small amount.
        </p>
        <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(200,247,197,0.04)", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.8, color: "rgba(200,247,197,0.7)" }}>
          <span style={{ color: "rgba(200,247,197,0.3)" }}># Create a new wallet in MetaMask</span><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}># Send it a small amount of RITUAL</span><br/><br/>
          cast send 0xNewHotWallet \<br/>
          {"  "}--value 0.05ether \<br/>
          {"  "}--rpc-url https://rpc.ritualfoundation.org \<br/>
          {"  "}--private-key $YOUR_MAIN_KEY
        </div>
      </div>

      {/* Step 3 */}
      <div className="glass-card p-8 text-left mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-black" style={{ color: "var(--mint)", opacity: 0.3 }}>03</span>
          <h2 className="font-black text-xl" style={{ color: "var(--mint)" }}>Start Autonomous Mode</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: "rgba(200,247,197,0.5)" }}>
          Give the agent your hot wallet key. It signs and sends transactions autonomously.
          Talk to it in chat to buy, sell, and list NFTs.
        </p>
        <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(200,247,197,0.04)", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.8, color: "rgba(200,247,197,0.7)" }}>
          pip install web3<br/><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}># Start with hot key (env var is safer)</span><br/>
          export AGENT_HOT_KEY=0xHotWalletPrivateKey<br/>
          python3 agent/agent.py --address 0xYourAgent<br/><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}># Agent is live at http://localhost:8888</span><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}># Dashboard: monitoring + policy</span><br/>
          <span style={{ color: "rgba(200,247,197,0.3)" }}># Actions: via chat commands</span>
        </div>
      </div>

      {/* API */}
      <div className="glass-card p-8 text-left mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">⚡</span>
          <h2 className="font-black text-xl" style={{ color: "var(--mint)" }}>Execution API</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: "rgba(200,247,197,0.5)" }}>
          Your agent exposes these endpoints. Tell it what to do in chat &mdash; it calls them automatically.
        </p>
        <div className="space-y-2">
          {[
            ["POST /api/buy", '{"nft":"0x...","tokenId":1,"price":"0.05"}', "Buy an NFT"],
            ["POST /api/list", '{"nft":"0x...","tokenId":1,"price":"0.1"}', "List for sale"],
            ["POST /api/cancel", '{"nft":"0x...","tokenId":1}', "Cancel listing"],
            ["GET /api/info", "—", "Agent status & balance"],
          ].map(([endpoint, body, desc]) => (
            <div key={endpoint} className="flex gap-3 p-3 rounded-lg text-xs" style={{ background: "rgba(200,247,197,0.04)" }}>
              <code className="font-bold whitespace-nowrap" style={{ color: "var(--mint)", minWidth: "140px" }}>{endpoint}</code>
              <span style={{ color: "rgba(200,247,197,0.4)" }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture */}
      <div className="glass-card p-8 text-left">
        <h2 className="font-black text-xl mb-4" style={{ color: "var(--mint)" }}>How It Works</h2>
        <div className="space-y-3 text-sm" style={{ color: "rgba(200,247,197,0.55)" }}>
          {[
            ["💬", "You chat", "Tell your agent what to do in natural language"],
            ["🤖", "Agent decides", "Reads SKILL.md, understands capabilities and contracts"],
            ["⚡", "Agent executes", "Calls the local API, signs with hot wallet, sends to Ritual Chain"],
            ["📊", "You monitor", "Dashboard shows balance, actions, policy — all on-chain"],
            ["🔒", "You control", "Set spend ceiling, permissions, mode — policy enforced by the contract"],
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
