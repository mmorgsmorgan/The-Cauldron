const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv/config");

function loadArtifact(name: string) {
  const p = path.join(__dirname, `../artifacts/src/${name}.sol/${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function main() {
  const RPC = process.env.RITUAL_RPC_URL || "https://rpc.ritualfoundation.org";
  const PK  = process.env.DEPLOYER_PRIVATE_KEY;
  if (!PK) { console.error("Set DEPLOYER_PRIVATE_KEY in .env"); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet   = new ethers.Wallet(PK, provider);

  console.log("═══════════════════════════════════════════");
  console.log("  CauldronAgent Deployment — Ritual Chain  ");
  console.log("═══════════════════════════════════════════");
  console.log(`Deployer:  ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance:   ${ethers.formatEther(balance)} RITUAL`);
  console.log();

  // Load deployed addresses
  const deployedPath = path.join(__dirname, "../deployed-addresses.json");
  let deployed: any = {};
  if (fs.existsSync(deployedPath)) {
    deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  }

  const MARKETPLACE = deployed.marketplace || process.env.MARKETPLACE_ADDRESS;
  const FACTORY     = deployed.factory     || process.env.FACTORY_ADDRESS;
  if (!MARKETPLACE || !FACTORY) {
    throw new Error("Missing marketplace or factory in deployed-addresses.json");
  }

  console.log(`Marketplace: ${MARKETPLACE}`);
  console.log(`Factory:     ${FACTORY}`);

  const SPEND_CEILING = ethers.parseEther("0.1");
  console.log(`Spend ceiling: 0.1 RITUAL`);
  console.log(`Mode:          SUPERVISED (0)`);
  console.log();

  // Legacy tx (no EIP-1559 on Ritual Chain)
  const gasPrice = BigInt("1000000007");
  const txBase   = { gasPrice, chainId: 1979 };
  const nonce    = await provider.getTransactionCount(wallet.address, "latest");

  // Deploy CauldronAgent
  console.log("Deploying CauldronAgent...");
  const artifact = loadArtifact("CauldronAgent");
  const factory  = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const deployTx = await factory.getDeployTransaction(MARKETPLACE, FACTORY, SPEND_CEILING);
  const sent     = await wallet.sendTransaction({
    ...txBase,
    nonce,
    data: deployTx.data,
    gasLimit: BigInt(5000000),
  });

  console.log(`Tx hash: ${sent.hash}`);
  console.log("Waiting for confirmation...");
  const receipt = await sent.wait();
  const agentAddress = receipt.contractAddress;

  console.log();
  console.log(`✅ CauldronAgent deployed at: ${agentAddress}`);
  console.log(`Explorer: https://explorer.ritualfoundation.org/address/${agentAddress}`);
  console.log();

  // Save address
  deployed.cauldronAgent = agentAddress;
  fs.writeFileSync(deployedPath, JSON.stringify(deployed, null, 2));
  console.log("✅ Address saved to deployed-addresses.json");
  console.log();

  // Next steps
  console.log("═══════════════════════════════════════════");
  console.log("  Next Steps");
  console.log("═══════════════════════════════════════════");
  console.log();
  console.log("1. Run the agent locally:");
  console.log(`   python3 agent/agent.py --address ${agentAddress}`);
  console.log();
  console.log("2. Fund the agent:");
  console.log(`   cast send ${agentAddress} --value 0.05ether --rpc-url ${RPC}`);
  console.log();
  console.log("3. Open http://localhost:8888 and connect MetaMask");
}

main().catch((err) => {
  console.error("Deployment failed:", err.message || err);
  process.exit(1);
});
