import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance));
  
  const currentNonce = await ethers.provider.getTransactionCount(deployer.address, "latest");
  console.log("Current nonce:", currentNonce);

  // Force legacy tx (type 0) — Ritual Chain doesn't support EIP-1559
  const overrides = {
    gasPrice: ethers.parseUnits("1", "gwei"),
    type: 0,
    nonce: currentNonce,
  };

  // 1. Deploy AIRitualNFT implementation
  console.log("\n1. Deploying AIRitualNFT implementation...");
  const AIRitualNFT = await ethers.getContractFactory("AIRitualNFT");
  const implementation = await AIRitualNFT.deploy(overrides);
  await implementation.waitForDeployment();
  const implAddress = await implementation.getAddress();
  console.log("   AIRitualNFT implementation:", implAddress);

  // 2. Deploy NFTFactory
  console.log("\n2. Deploying NFTFactory...");
  const NFTFactory = await ethers.getContractFactory("NFTFactory");
  const factory = await NFTFactory.deploy(implAddress, { ...overrides, nonce: currentNonce + 1 });
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("   NFTFactory:", factoryAddress);

  // 3. Deploy RitualMarketplace
  console.log("\n3. Deploying RitualMarketplace...");
  const RitualMarketplace = await ethers.getContractFactory("RitualMarketplace");
  const marketplace = await RitualMarketplace.deploy(250, deployer.address, { ...overrides, nonce: currentNonce + 2 });
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("   RitualMarketplace:", marketplaceAddress);

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("DEPLOYMENT COMPLETE — RITUAL CHAIN");
  console.log("=".repeat(50));
  console.log(`IMPLEMENTATION_ADDRESS=${implAddress}`);
  console.log(`FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`MARKETPLACE_ADDRESS=${marketplaceAddress}`);
  console.log("=".repeat(50));

  // Write addresses
  const fs = await import("fs");
  const addresses = {
    chainId: 1979,
    network: "ritual",
    implementation: implAddress,
    factory: factoryAddress,
    marketplace: marketplaceAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync("./deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to deployed-addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
