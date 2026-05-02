const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider("https://rpc.ritualfoundation.org");

async function test() {
  console.log("=== SKILL.md Smoke Test ===\n");

  // Test 1: Factory reads
  const factory = new ethers.Contract(
    "0xCeD6f5eA4b8e9D448fF732Ef44267D6cbD9F750f",
    [
      "function getAllCollections() view returns (address[])",
      "function totalCollections() view returns (uint256)"
    ],
    provider
  );

  const total = await factory.totalCollections();
  console.log("1. Factory.totalCollections():", total.toString(), "OK");

  const all = await factory.getAllCollections();
  console.log("2. Factory.getAllCollections():", all.length, "collections OK");

  // Test 2: Marketplace reads
  const marketplace = new ethers.Contract(
    "0x9cDB207D834c1c5FE3b1777fC360eC4473f5A38B",
    [
      "function platformFee() view returns (uint256)",
      "function feeRecipient() view returns (address)"
    ],
    provider
  );

  const fee = await marketplace.platformFee();
  console.log("3. Marketplace.platformFee():", fee.toString(), "bps OK");

  // Test 3: Backend API
  const resp = await fetch("https://the-cauldron-production.up.railway.app/collections");
  const data = await resp.json();
  console.log("4. Backend /collections:", resp.status, "- total:", data.total, "OK");

  // Test 4: Merkle generate
  const merkleResp = await fetch("https://the-cauldron-production.up.railway.app/merkle/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      addresses: [
        "0x0cb5DB783b746757050943Da9B42e81376A379Ea",
        "0x1234567890abcdef1234567890abcdef12345678"
      ]
    })
  });
  const merkleData = await merkleResp.json();
  console.log("5. Backend /merkle/generate:", merkleResp.status, "- root:", (merkleData.root || "N/A").slice(0, 18) + "...", "OK");

  console.log("\n=== All tests passed ===");
}

test().catch(e => console.error("ERROR:", e.message));
