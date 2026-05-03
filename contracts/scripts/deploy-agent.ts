import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploy CauldronAgent.sol to Ritual Chain
 *
 * Usage:
 *   npx hardhat run scripts/deploy-agent.ts --network ritual
 *
 * Requires:
 *   - DEPLOYER_PRIVATE_KEY in contracts/.env
 *   - Deployer wallet funded with RITUAL for gas + agent seed funds
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════");
  console.log("  CauldronAgent Deployment — Ritual Chain  ");
  console.log("═══════════════════════════════════════════");
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Balance:   ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} RITUAL`);
  console.log(`Chain ID:  ${(await ethers.provider.getNetwork()).chainId}`);
  console.log();

  // ── Load deployed contract addresses ──────────────────────────────────────

  const deployedPath = path.join(__dirname, "../deployed-addresses.json");
  let deployed: any = {};
  if (fs.existsSync(deployedPath)) {
    deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  }

  const MARKETPLACE = deployed.marketplace || process.env.MARKETPLACE_ADDRESS;
  const FACTORY     = deployed.factory     || process.env.FACTORY_ADDRESS;

  if (!MARKETPLACE || !FACTORY) {
    throw new Error(
      "Missing MARKETPLACE_ADDRESS or FACTORY_ADDRESS. " +
      "Check deployed-addresses.json or set env vars."
    );
  }

  console.log(`Marketplace: ${MARKETPLACE}`);
  console.log(`Factory:     ${FACTORY}`);
  console.log();

  // ── Agent Policy Settings ─────────────────────────────────────────────────

  // spendCeiling: max RITUAL per single buy — start conservative at 0.1 RITUAL
  const SPEND_CEILING = ethers.parseEther("0.1");

  console.log(`Spend ceiling: ${ethers.formatEther(SPEND_CEILING)} RITUAL`);
  console.log(`Mode:          SUPERVISED (0) — requires owner approval for each action`);
  console.log();

  // ── Deploy ────────────────────────────────────────────────────────────────

  console.log("Deploying CauldronAgent...");
  const CauldronAgent = await ethers.getContractFactory("CauldronAgent");
  const agent = await CauldronAgent.deploy(
    MARKETPLACE,
    FACTORY,
    SPEND_CEILING,
    {
      gasLimit: 3000000,
      gasPrice: 1000000007,   // 1 gwei — legacy tx for Ritual Chain
      type:     0,
    }
  );

  await agent.waitForDeployment();
  const agentAddress = await agent.getAddress();

  console.log(`✅ CauldronAgent deployed at: ${agentAddress}`);
  console.log();

  // ── Verify deployment ─────────────────────────────────────────────────────

  const info = await agent.getAgentInfo();
  console.log("Agent Identity:", info[0]);
  console.log("Mode:          ", info[1].toString(), "(0=SUPERVISED)");
  console.log("Spend Ceiling: ", ethers.formatEther(info[2]), "RITUAL");
  console.log("Allow Buy:     ", info[3]);
  console.log("Allow List:    ", info[4]);
  console.log("Allow Cancel:  ", info[5]);
  console.log("Min Confidence:", info[6].toString(), "%");
  console.log();

  // ── Save address ──────────────────────────────────────────────────────────

  deployed.cauldronAgent = agentAddress;
  fs.writeFileSync(deployedPath, JSON.stringify(deployed, null, 2));
  console.log(`✅ Address saved to deployed-addresses.json`);
  console.log();

  // ── Next steps ────────────────────────────────────────────────────────────

  console.log("═══════════════════════════════════════════");
  console.log("  Next Steps");
  console.log("═══════════════════════════════════════════");
  console.log();
  console.log("1. Fund the agent with RITUAL (for buying NFTs):");
  console.log(`   cast send ${agentAddress} --value 0.5ether --rpc-url https://rpc.ritualfoundation.org`);
  console.log();
  console.log("2. If the agent owns NFTs and wants to list them,");
  console.log("   approve the marketplace for each collection:");
  console.log(`   agent.approveCollection(<nftContractAddress>)`);
  console.log();
  console.log("3. Request an AI decision:");
  console.log(`   agent.requestDecision(<nftContract>, <tokenId>, <currentPrice>, "analyze this NFT")`);
  console.log();
  console.log("4. In SUPERVISED mode, approve or reject the queued action:");
  console.log(`   agent.approveAction(<actionId>)`);
  console.log(`   agent.rejectAction(<actionId>, "too expensive")`);
  console.log();
  console.log("5. To switch to AUTONOMOUS mode (use with caution):");
  console.log(`   agent.setPolicy(1, spendCeiling, maxListPrice, true, true, true, 80)`);
  console.log();
  console.log(`Explorer: https://explorer.ritualfoundation.org/address/${agentAddress}`);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
