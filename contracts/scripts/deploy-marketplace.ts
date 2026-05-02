import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying RitualMarketplace with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Already deployed:
  const implAddress = "0x3992b7359c2Efabde4D563806937408FD64690D0";
  const factoryAddress = "0xADDFBdCb5f8F3b4D6b25B6702Ed306A14A86624a";

  // Deploy RitualMarketplace (2.5% platform fee)
  console.log("\nDeploying RitualMarketplace...");
  const RitualMarketplace = await ethers.getContractFactory("RitualMarketplace");
  const marketplace = await RitualMarketplace.deploy(250, deployer.address);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("   RitualMarketplace:", marketplaceAddress);

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(50));
  console.log(`IMPLEMENTATION_ADDRESS=${implAddress}`);
  console.log(`FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`MARKETPLACE_ADDRESS=${marketplaceAddress}`);
  console.log("=".repeat(50));

  const fs = await import("fs");
  const network = await ethers.provider.getNetwork();
  const addresses = {
    chainId: Number(network.chainId),
    network: network.name,
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
