const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider("https://rpc.ritualfoundation.org");
const wallet = new ethers.Wallet("0x38b0b8b0e61dbea65df7ec5b1961e130fe75f24834b95e026a05a7fcc3989be2", provider);

(async () => {
  const addr = wallet.address;
  const balance = await provider.getBalance(addr);
  const nonce = await provider.getTransactionCount(addr);
  const pendingNonce = await provider.getTransactionCount(addr, "pending");
  const feeData = await provider.getFeeData();
  console.log("Address:", addr);
  console.log("Balance:", ethers.formatEther(balance), "RITUAL");
  console.log("Confirmed nonce:", nonce);
  console.log("Pending nonce:", pendingNonce);
  console.log("Gas price:", feeData.gasPrice?.toString());
})();
