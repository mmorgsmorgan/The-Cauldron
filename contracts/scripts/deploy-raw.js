const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Load artifacts
function loadArtifact(name) {
  const p = path.join(__dirname, `../artifacts/src/${name}.sol/${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function main() {
  const RPC = "https://rpc.ritualfoundation.org";
  const PK = process.env.DEPLOYER_PRIVATE_KEY;
  if (!PK) { console.error("Set DEPLOYER_PRIVATE_KEY env var"); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);

  console.log("Deployer:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "RITUAL");

  const nonce = await provider.getTransactionCount(wallet.address, "latest");
  console.log("Nonce:", nonce);

  // Legacy tx overrides (no EIP-1559)
  const gasPrice = BigInt("1000000007"); // 1 gwei
  const txBase = { gasPrice, chainId: 1979 };

  // ── 1. AIRitualNFT Implementation ──
  console.log("\n1. Deploying AIRitualNFT implementation...");
  const implArtifact = loadArtifact("AIRitualNFT");
  const implFactory = new ethers.ContractFactory(implArtifact.abi, implArtifact.bytecode, wallet);
  const implTx = await implFactory.getDeployTransaction();
  const implSent = await wallet.sendTransaction({
    ...txBase,
    nonce,
    data: implTx.data,
    gasLimit: BigInt(4000000),
  });
  console.log("   TX:", implSent.hash);
  const implReceipt = await implSent.wait();
  const implAddress = implReceipt.contractAddress;
  console.log("   AIRitualNFT implementation:", implAddress);

  // ── 2. NFTFactory ──
  console.log("\n2. Deploying NFTFactory...");
  const factArtifact = loadArtifact("NFTFactory");
  const factFactory = new ethers.ContractFactory(factArtifact.abi, factArtifact.bytecode, wallet);
  const factTx = await factFactory.getDeployTransaction(implAddress);
  const factSent = await wallet.sendTransaction({
    ...txBase,
    nonce: nonce + 1,
    data: factTx.data,
    gasLimit: BigInt(2000000),
  });
  console.log("   TX:", factSent.hash);
  const factReceipt = await factSent.wait();
  const factoryAddress = factReceipt.contractAddress;
  console.log("   NFTFactory:", factoryAddress);

  // ── 3. RitualMarketplace ──
  console.log("\n3. Deploying RitualMarketplace...");
  const mktArtifact = loadArtifact("RitualMarketplace");
  const mktFactory = new ethers.ContractFactory(mktArtifact.abi, mktArtifact.bytecode, wallet);
  const mktTx = await mktFactory.getDeployTransaction(250, wallet.address);
  const mktSent = await wallet.sendTransaction({
    ...txBase,
    nonce: nonce + 2,
    data: mktTx.data,
    gasLimit: BigInt(2000000),
  });
  console.log("   TX:", mktSent.hash);
  const mktReceipt = await mktSent.wait();
  const marketplaceAddress = mktReceipt.contractAddress;
  console.log("   RitualMarketplace:", marketplaceAddress);

  // ── Summary ──
  console.log("\n" + "=".repeat(50));
  console.log("DEPLOYMENT COMPLETE — RITUAL CHAIN (1979)");
  console.log("=".repeat(50));
  console.log("FACTORY_ADDRESS=" + factoryAddress);
  console.log("MARKETPLACE_ADDRESS=" + marketplaceAddress);
  console.log("IMPLEMENTATION=" + implAddress);
  console.log("=".repeat(50));

  const addresses = {
    chainId: 1979,
    network: "ritual",
    implementation: implAddress,
    factory: factoryAddress,
    marketplace: marketplaceAddress,
    deployer: wallet.address,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(__dirname, "../deployed-addresses.json"),
    JSON.stringify(addresses, null, 2)
  );
  console.log("\nAddresses saved to deployed-addresses.json");
}

main().catch((e) => { 
  console.error("Error message:", e.message);
  if (e.info) console.error("Error info:", JSON.stringify(e.info, null, 2));
  if (e.error) console.error("Inner error:", JSON.stringify(e.error, null, 2));
  process.exit(1); 
});
