#!/usr/bin/env python3
"""
CauldronAgent Local Server
--------------------------
A lightweight Python HTTP server that reads SKILL.md, generates a
self-contained agent dashboard, and serves it locally.

No Node.js required. No build step. Python stdlib only.

Usage:
    python3 agent.py --address 0xYourAgentAddress
    python3 agent.py --address 0xYourAgentAddress --port 8888
    python3 agent.py --address 0xYourAgentAddress --skill ./SKILL.md

Then open: http://localhost:8888
"""

import argparse
import http.server
import json
import os
import re
import sys
import urllib.request

# ── Defaults ──────────────────────────────────────────────────────────────────

SKILL_URL    = "https://raw.githubusercontent.com/mmorgsmorgan/The-Cauldron/main/SKILL.md"
MARKETPLACE  = "0x9cDB207D834c1c5FE3b1777fC360eC4473f5A38B"
FACTORY      = "0xCeD6f5eA4b8e9D448fF732Ef44267D6cbD9F750f"
CHAIN_ID     = 1979
RPC_URL      = "https://rpc.ritualfoundation.org"

# ── Read SKILL.md ─────────────────────────────────────────────────────────────

def read_skill(path=None):
    if path and os.path.exists(path):
        print(f"[agent] Reading skill from local file: {path}")
        with open(path, "r") as f:
            return f.read()
    print(f"[agent] Fetching skill from GitHub...")
    try:
        req = urllib.request.Request(SKILL_URL, headers={"User-Agent": "CauldronAgent/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.read().decode("utf-8")
    except Exception as e:
        print(f"[agent] Warning: could not fetch SKILL.md ({e}). Using defaults.")
        return ""

def parse_skill(skill_text):
    """Extract key facts from SKILL.md for UI generation."""
    info = {
        "version":    "5.2",
        "chain":      "Ritual Chain",
        "chain_id":   CHAIN_ID,
        "rpc":        RPC_URL,
        "marketplace": MARKETPLACE,
        "factory":    FACTORY,
        "intents":    ["buy", "list", "cancel", "monitor", "deploy"],
    }
    for line in skill_text.splitlines():
        if "Skill Version" in line:
            parts = line.split(":")
            if len(parts) > 1:
                info["version"] = parts[1].strip().split()[0]
        # Extract contract addresses from SKILL.md table
        if "RitualMarketplace" in line and "0x" in line:
            m = re.search(r"(0x[0-9a-fA-F]{40})", line)
            if m:
                info["marketplace"] = m.group(1)
        if "NFTFactory" in line and "0x" in line:
            m = re.search(r"(0x[0-9a-fA-F]{40})", line)
            if m:
                info["factory"] = m.group(1)
    return info

# ── Generate HTML UI ──────────────────────────────────────────────────────────

def generate_html(agent_address, skill_info):
    """Generate a self-contained HTML dashboard for this agent instance."""
    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>CauldronAgent - {{AGENT_SHORT}}</title>
  <script src="https://cdn.jsdelivr.net/npm/ethers@6.13.4/dist/ethers.umd.min.js"></script>
  <style>
    :root {
      --mint: #c8f7c5; --bg: #040f0a; --card: #0a2e1f;
      --border: rgba(200,247,197,0.1); --muted: rgba(200,247,197,0.45);
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:var(--bg); color:var(--mint); font-family:system-ui,sans-serif;
           min-height:100vh; padding:2rem; }
    h1 { font-size:1.8rem; font-weight:900; margin-bottom:.25rem; }
    .sub { color:var(--muted); font-size:.85rem; margin-bottom:2rem; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:1rem; margin-bottom:2rem; }
    .card { background:var(--card); border:1px solid var(--border); border-radius:1rem; padding:1.25rem; }
    .card label { font-size:.7rem; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; display:block; margin-bottom:.4rem; }
    .card .val { font-size:1.1rem; font-weight:800; }
    .badge { display:inline-block; padding:.3rem .8rem; border-radius:2rem; font-size:.7rem;
             font-weight:800; text-transform:uppercase; letter-spacing:.08em; }
    .badge-sup { background:rgba(255,200,50,.1); color:rgba(255,200,50,.9); border:1px solid rgba(255,200,50,.3); }
    .badge-aut { background:rgba(100,255,150,.1); color:rgba(100,255,150,.9); border:1px solid rgba(100,255,150,.3); }
    .badge-dry { background:rgba(150,150,255,.1); color:rgba(150,150,255,.9); border:1px solid rgba(150,150,255,.3); }
    .section { background:var(--card); border:1px solid var(--border); border-radius:1rem;
               padding:1.5rem; margin-bottom:1.5rem; }
    .section h2 { font-size:1rem; font-weight:800; margin-bottom:1rem; }
    input, select, textarea {
      width:100%; padding:.75rem 1rem; background:rgba(10,46,31,.8);
      border:1px solid rgba(200,247,197,.12); border-radius:.75rem;
      color:var(--mint); font-size:.875rem; outline:none; margin-bottom:.75rem;
      font-family:inherit;
    }
    input:focus, select:focus, textarea:focus { border-color:rgba(200,247,197,.3); }
    button { padding:.75rem 1.5rem; background:var(--mint); color:#040f0a;
             border:none; border-radius:.75rem; font-weight:800; font-size:.875rem;
             cursor:pointer; transition:all .2s; width:100%; }
    button:hover { background:#ddfbdb; transform:translateY(-1px); }
    button:disabled { opacity:.4; cursor:not-allowed; transform:none; }
    .log { font-family:monospace; font-size:.78rem; color:var(--muted);
           max-height:200px; overflow-y:auto; margin-top:1rem;
           background:rgba(0,0,0,.3); padding:1rem; border-radius:.5rem; }
    .log .entry { margin-bottom:.3rem; }
    .log .ok  { color:rgba(100,255,150,.8); }
    .log .err { color:rgba(255,120,120,.8); }
    .log .inf { color:rgba(200,247,197,.5); }
    #status-bar { position:fixed; bottom:1rem; right:1rem; padding:.5rem 1rem;
                  background:rgba(10,46,31,.9); border:1px solid var(--border);
                  border-radius:.75rem; font-size:.75rem; display:none; }
    .row2 { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
    a { color:var(--mint); }
  </style>
</head>
<body>
  <div style="max-width:860px;margin:0 auto;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.25rem;">
      <h1>🤖 CauldronAgent</h1>
      <span id="mode-badge" class="badge badge-sup">SUPERVISED</span>
    </div>
    <p class="sub">
      Agent: <code>{{AGENT}}</code> &bull;
      Skill v{{VERSION}} &bull;
      Ritual Chain ({{CHAIN_ID}}) &bull;
      <span id="wallet-addr">Not connected</span>
    </p>

    <!-- Stats -->
    <div class="grid">
      <div class="card"><label>Balance</label><div class="val" id="balance">—</div></div>
      <div class="card"><label>Total Spent</label><div class="val" id="spent">—</div></div>
      <div class="card"><label>Actions Executed</label><div class="val" id="actions">—</div></div>
      <div class="card"><label>Pending Queue</label><div class="val" id="queue">—</div></div>
    </div>

    <!-- Connect -->
    <div class="section">
      <h2>🔑 Wallet</h2>
      <button id="btn-connect" onclick="connectWallet()">Connect Wallet (MetaMask)</button>
    </div>

    <!-- Policy -->
    <div class="section">
      <h2>⚙️ Policy</h2>
      <label>Mode</label>
      <select id="pol-mode">
        <option value="0">SUPERVISED — queue actions for approval</option>
        <option value="1">AUTONOMOUS — execute immediately</option>
        <option value="2">DRY_RUN — log only, no execution</option>
      </select>
      <div class="row2">
        <div>
          <label>Spend Ceiling (RITUAL)</label>
          <input id="pol-ceiling" type="number" step="0.01" value="0.1"/>
        </div>
        <div>
          <label>Min Confidence (%)</label>
          <input id="pol-conf" type="number" min="0" max="100" value="70"/>
        </div>
      </div>
      <div class="row2" style="margin-bottom:.75rem;">
        <label><input type="checkbox" id="pol-buy" checked/> Allow Buy</label>
        <label><input type="checkbox" id="pol-list" checked/> Allow List</label>
        <label><input type="checkbox" id="pol-cancel" checked/> Allow Cancel</label>
      </div>
      <button onclick="setPolicy()">Update Policy On-Chain</button>
    </div>

    <!-- Request Decision -->
    <div class="section">
      <h2>🧠 Request AI Decision</h2>
      <label>NFT Contract Address</label>
      <input id="act-nft" placeholder="0x..."/>
      <div class="row2">
        <div><label>Token ID</label><input id="act-token" type="number" value="0"/></div>
        <div><label>Current Price (RITUAL)</label><input id="act-price" type="number" step="0.001" value="0"/></div>
      </div>
      <label>Context / Instructions</label>
      <textarea id="act-context" rows="2" placeholder="e.g. Floor dropped 20%, consider buying"></textarea>
      <button onclick="requestDecision()">🧠 Submit to Sovereign Agent Precompile</button>
    </div>

    <!-- Direct Actions -->
    <div class="section">
      <h2>⚡ Direct Actions (Owner Override)</h2>
      <label>NFT Contract</label>
      <input id="dir-nft" placeholder="0x..."/>
      <div class="row2">
        <div><label>Token ID</label><input id="dir-token" type="number" value="0"/></div>
        <div><label>Price (RITUAL)</label><input id="dir-price" type="number" step="0.001" value="0.05"/></div>
      </div>
      <div class="row2">
        <button onclick="directBuy()">Buy NFT</button>
        <button onclick="directList()">List NFT</button>
      </div>
    </div>

    <!-- Log -->
    <div class="section">
      <h2>📋 Activity Log</h2>
      <div class="log" id="log"></div>
    </div>
  </div>

  <div id="status-bar"></div>

<script>
const AGENT   = "{{AGENT}}";
const MARKET  = "{{MARKETPLACE}}";
const RPC     = "{{RPC}}";
const CHAIN   = {{CHAIN_ID}};

const AGENT_ABI = [
  "function getAgentInfo() view returns (string,uint8,uint256,bool,bool,bool,uint8,uint256,uint256,uint256)",
  "function getPendingQueueLength() view returns (uint256)",
  "function setPolicy(uint8,uint256,uint256,bool,bool,bool,uint8)",
  "function requestDecision(address,uint256,uint256,string) returns (bytes32)",
  "function directBuy(address,uint256,uint256)",
  "function directList(address,uint256,uint256)",
  "function owner() view returns (address)",
];

let provider, signer, contract;
const MODES = ["SUPERVISED","AUTONOMOUS","DRY_RUN"];
const BADGE = ["badge-sup","badge-aut","badge-dry"];

function log(msg, type="inf") {
  const d = document.getElementById("log");
  const e = document.createElement("div");
  e.className = "entry " + type;
  e.textContent = "[" + new Date().toLocaleTimeString() + "] " + msg;
  d.prepend(e);
}

function status(msg) {
  const b = document.getElementById("status-bar");
  b.style.display = "block";
  b.textContent = msg;
  setTimeout(() => { b.style.display = "none"; }, 3000);
}

async function connectWallet() {
  if (!window.ethereum) { log("MetaMask not found", "err"); return; }
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    // Switch to Ritual Chain
    try {
      await provider.send("wallet_switchEthereumChain", [{ chainId: "0x" + CHAIN.toString(16) }]);
    } catch(e) {
      if (e.code === 4902) {
        await provider.send("wallet_addEthereumChain", [{
          chainId: "0x" + CHAIN.toString(16),
          chainName: "Ritual Chain",
          nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 },
          rpcUrls: [RPC],
          blockExplorerUrls: ["https://explorer.ritualfoundation.org"],
        }]);
      }
    }
    signer   = await provider.getSigner();
    contract = new ethers.Contract(AGENT, AGENT_ABI, signer);
    const addr = await signer.getAddress();
    document.getElementById("wallet-addr").textContent = addr.slice(0,8) + "...";
    document.getElementById("btn-connect").textContent = "Connected ✓";
    document.getElementById("btn-connect").disabled = true;
    log("Wallet connected: " + addr, "ok");
    await refresh();
    setInterval(refresh, 8000);
  } catch(e) { log("Connect failed: " + e.message, "err"); }
}

async function refresh() {
  if (!contract) return;
  try {
    const info = await contract.getAgentInfo();
    const q    = await contract.getPendingQueueLength();
    const mode = Number(info[1]);
    document.getElementById("balance").textContent  = Number(ethers.formatEther(info[7])).toFixed(4) + " RITUAL";
    document.getElementById("spent").textContent    = Number(ethers.formatEther(info[8])).toFixed(4) + " RITUAL";
    document.getElementById("actions").textContent  = info[9].toString();
    document.getElementById("queue").textContent    = q.toString();
    const badge = document.getElementById("mode-badge");
    badge.textContent  = MODES[mode];
    badge.className    = "badge " + BADGE[mode];
    document.getElementById("pol-mode").value    = mode;
    document.getElementById("pol-ceiling").value = ethers.formatEther(info[2]);
    document.getElementById("pol-conf").value    = info[6].toString();
    document.getElementById("pol-buy").checked   = info[3];
    document.getElementById("pol-list").checked  = info[4];
    document.getElementById("pol-cancel").checked = info[5];
  } catch(e) { log("Refresh error: " + e.message, "err"); }
}

async function setPolicy() {
  if (!contract) { log("Connect wallet first", "err"); return; }
  try {
    log("Setting policy...", "inf");
    const tx = await contract.setPolicy(
      parseInt(document.getElementById("pol-mode").value),
      ethers.parseEther(document.getElementById("pol-ceiling").value || "0.1"),
      ethers.parseEther("100"),
      document.getElementById("pol-buy").checked,
      document.getElementById("pol-list").checked,
      document.getElementById("pol-cancel").checked,
      parseInt(document.getElementById("pol-conf").value || "70"),
      { gasLimit: 100000n }
    );
    log("Tx sent: " + tx.hash, "inf");
    await tx.wait();
    log("Policy updated!", "ok");
    await refresh();
  } catch(e) { log("Error: " + e.message, "err"); }
}

async function requestDecision() {
  if (!contract) { log("Connect wallet first", "err"); return; }
  const nft = document.getElementById("act-nft").value;
  if (!nft.match(/^0x[0-9a-fA-F]{40}$/)) { log("Invalid NFT address", "err"); return; }
  try {
    log("Submitting to Sovereign Agent precompile...", "inf");
    const tx = await contract.requestDecision(
      nft,
      BigInt(document.getElementById("act-token").value || "0"),
      ethers.parseEther(document.getElementById("act-price").value || "0"),
      document.getElementById("act-context").value || "Analyze this NFT",
      { gasLimit: 500000n }
    );
    log("Tx sent: " + tx.hash, "inf");
    await tx.wait();
    log("Decision requested! Await AsyncDelivery callback.", "ok");
  } catch(e) { log("Error: " + e.message, "err"); }
}

async function directBuy() {
  if (!contract) { log("Connect wallet first", "err"); return; }
  const nft   = document.getElementById("dir-nft").value;
  const price = document.getElementById("dir-price").value;
  if (!nft.match(/^0x[0-9a-fA-F]{40}$/)) { log("Invalid address", "err"); return; }
  try {
    log("Buying NFT...", "inf");
    const tx = await contract.directBuy(
      nft,
      BigInt(document.getElementById("dir-token").value || "0"),
      ethers.parseEther(price),
      { gasLimit: 300000n }
    );
    log("Tx sent: " + tx.hash, "inf");
    await tx.wait();
    log("NFT bought!", "ok");
  } catch(e) { log("Error: " + e.message, "err"); }
}

async function directList() {
  if (!contract) { log("Connect wallet first", "err"); return; }
  const nft   = document.getElementById("dir-nft").value;
  const price = document.getElementById("dir-price").value;
  if (!nft.match(/^0x[0-9a-fA-F]{40}$/)) { log("Invalid address", "err"); return; }
  try {
    log("Listing NFT...", "inf");
    const tx = await contract.directList(
      nft,
      BigInt(document.getElementById("dir-token").value || "0"),
      ethers.parseEther(price),
      { gasLimit: 200000n }
    );
    log("Tx sent: " + tx.hash, "inf");
    await tx.wait();
    log("NFT listed!", "ok");
  } catch(e) { log("Error: " + e.message, "err"); }
}

log("Agent UI loaded. Connect your wallet to begin.", "inf");
log("Agent contract: " + AGENT, "inf");
</script>
</body>
</html>"""
    html = html.replace("{{AGENT}}", agent_address)
    html = html.replace("{{AGENT_SHORT}}", agent_address[:10] + "..." if agent_address else "unset")
    html = html.replace("{{VERSION}}", skill_info["version"])
    html = html.replace("{{CHAIN_ID}}", str(skill_info["chain_id"]))
    html = html.replace("{{RPC}}", skill_info["rpc"])
    html = html.replace("{{MARKETPLACE}}", skill_info["marketplace"])
    return html

# ── HTTP Server ───────────────────────────────────────────────────────────────

class AgentHandler(http.server.BaseHTTPRequestHandler):
    html = ""

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(AgentHandler.html.encode("utf-8"))
        elif self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b'{"status":"ok","agent":"CauldronAgent"}')
        elif self.path == "/api/info":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(AgentHandler.info).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not found")

    def log_message(self, fmt, *args):
        print(f"[http] {args[0]} {args[1]}")

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="CauldronAgent Local UI Server")
    parser.add_argument("--address", required=False, default="0x0000000000000000000000000000000000000000",
                        help="Deployed CauldronAgent contract address (0x...)")
    parser.add_argument("--port",    type=int, default=8888, help="Port to serve on (default: 8888)")
    parser.add_argument("--skill",   default=None,           help="Path to local SKILL.md (optional)")
    args = parser.parse_args()

    print("=" * 52)
    print("  CauldronAgent Local Server")
    print("=" * 52)
    print(f"  Agent:  {args.address}")
    print(f"  Port:   {args.port}")
    print()

    skill_text         = read_skill(args.skill)
    skill_info         = parse_skill(skill_text)
    skill_info["agent_address"] = args.address
    AgentHandler.html  = generate_html(args.address, skill_info)
    AgentHandler.info  = skill_info

    print(f"[agent] Skill v{skill_info['version']} loaded.")
    print(f"[agent] Chain: {skill_info['chain']} (ID {skill_info['chain_id']})")
    print(f"[agent] Serving at http://localhost:{args.port}")
    print(f"[agent] Press Ctrl+C to stop.")
    print()

    server = http.server.HTTPServer(("", args.port), AgentHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[agent] Stopped.")
        server.server_close()

if __name__ == "__main__":
    main()
