import { ethers } from "ethers";
import dotenv from "dotenv";
import {
  upsertNFT,
  insertTransfer,
  getLastIndexedBlock,
  setLastIndexedBlock,
  getNFTsPendingMetadata,
  updateMetadata,
  upsertCollection,
} from "../db/queries";

dotenv.config();

const RPC_URL = process.env.RITUAL_RPC_URL || "https://rpc.ritualfoundation.org";
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || ethers.ZeroAddress;
const MARKETPLACE_ADDRESS = process.env.MARKETPLACE_ADDRESS || ethers.ZeroAddress;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || "3000");
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "2000");
const IPFS_GATEWAY = process.env.IPFS_GATEWAY || "https://ipfs.io/ipfs/";

// ERC721 Transfer event topic
const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

// Factory CollectionCreated event
const COLLECTION_CREATED_TOPIC = ethers.id(
  "CollectionCreated(address,address,string,string,uint256,uint256)"
);

// Marketplace events
const ITEM_LISTED_TOPIC = ethers.id("ItemListed(address,address,uint256,uint256)");
const ITEM_BOUGHT_TOPIC = ethers.id("ItemBought(address,address,uint256,uint256,address)");
const ITEM_CANCELED_TOPIC = ethers.id("ItemCanceled(address,address,uint256)");

const provider = new ethers.JsonRpcProvider(RPC_URL);

// ──────────────────────────────────────────────
//  Transfer Listener
// ──────────────────────────────────────────────

async function processTransferLog(log: ethers.Log) {
  try {
    if (log.topics.length < 4) return;

    const contract = log.address.toLowerCase();
    const from = ethers.getAddress("0x" + log.topics[1].slice(26));
    const to = ethers.getAddress("0x" + log.topics[2].slice(26));
    const tokenId = BigInt(log.topics[3]).toString();

    // Skip zero-to-zero (shouldn't happen but defensive)
    if (from === ethers.ZeroAddress && to === ethers.ZeroAddress) return;

    // Update ownership
    await upsertNFT(contract, tokenId, to);

    // Record transfer
    await insertTransfer(
      contract,
      tokenId,
      from,
      to,
      log.blockNumber,
      log.transactionHash
    );

    console.log(
      `📦 Transfer: ${contract.slice(0, 8)}... #${tokenId} → ${to.slice(0, 8)}...`
    );
  } catch (err) {
    console.error("Error processing transfer log:", err);
  }
}

// ──────────────────────────────────────────────
//  Factory Event Listener
// ──────────────────────────────────────────────

async function processFactoryLog(log: ethers.Log) {
  try {
    const iface = new ethers.Interface([
      "event CollectionCreated(address indexed owner, address indexed collection, string name, string symbol, uint256 maxSupply, uint256 timestamp)",
    ]);
    const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
    if (!parsed) return;

    const { owner, collection, name, symbol, maxSupply } = parsed.args;

    await upsertCollection(
      collection,
      name,
      symbol,
      owner,
      Number(maxSupply),
      "",
      true // factory-deployed = verified
    );

    console.log(`🏭 New collection: ${name} (${collection.slice(0, 10)}...) by ${owner.slice(0, 10)}...`);
  } catch (err) {
    console.error("Error processing factory log:", err);
  }
}

// ──────────────────────────────────────────────
//  Metadata Fetcher
// ──────────────────────────────────────────────

function resolveIPFS(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return IPFS_GATEWAY + uri.slice(7);
  }
  return uri;
}

async function fetchTokenMetadata(contract: string, tokenId: string) {
  try {
    const nftContract = new ethers.Contract(
      contract,
      ["function tokenURI(uint256 tokenId) view returns (string)"],
      provider
    );

    let uri: string;
    try {
      uri = await nftContract.tokenURI(tokenId);
    } catch {
      await updateMetadata(contract, tokenId, null, null, "unrevealed");
      return;
    }

    if (!uri) {
      await updateMetadata(contract, tokenId, null, null, "unrevealed");
      return;
    }

    const resolvedUri = resolveIPFS(uri);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(resolvedUri, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        await updateMetadata(contract, tokenId, uri, null, "broken");
        return;
      }

      const metadata = await response.json();
      await updateMetadata(contract, tokenId, uri, metadata as object, "full");
      console.log(`🎨 Metadata fetched: ${contract.slice(0, 8)}... #${tokenId}`);
    } catch {
      clearTimeout(timeout);
      await updateMetadata(contract, tokenId, uri, null, "broken");
    }
  } catch (err) {
    console.error(`Error fetching metadata for ${contract}#${tokenId}:`, err);
  }
}

// ──────────────────────────────────────────────
//  Backfill + Poll Loop
// ──────────────────────────────────────────────

async function processBlockRange(fromBlock: number, toBlock: number) {
  // Fetch all Transfer events in range
  const transferLogs = await provider.getLogs({
    fromBlock,
    toBlock,
    topics: [TRANSFER_TOPIC],
  });

  for (const log of transferLogs) {
    await processTransferLog(log);
  }

  // Fetch factory events if factory is deployed
  if (FACTORY_ADDRESS !== ethers.ZeroAddress) {
    const factoryLogs = await provider.getLogs({
      fromBlock,
      toBlock,
      address: FACTORY_ADDRESS,
      topics: [COLLECTION_CREATED_TOPIC],
    });

    for (const log of factoryLogs) {
      await processFactoryLog(log);
    }
  }

  await setLastIndexedBlock(toBlock);
}

async function backfill() {
  const lastIndexed = await getLastIndexedBlock();
  const currentBlock = await provider.getBlockNumber();
  const startBlock = Math.max(lastIndexed + 1, parseInt(process.env.START_BLOCK || "0"));

  if (startBlock >= currentBlock) {
    console.log("✅ Already up to date");
    return currentBlock;
  }

  console.log(`🔄 Backfilling from block ${startBlock} to ${currentBlock}...`);

  for (let from = startBlock; from <= currentBlock; from += BATCH_SIZE) {
    const to = Math.min(from + BATCH_SIZE - 1, currentBlock);
    console.log(`   Processing blocks ${from} - ${to}...`);

    try {
      await processBlockRange(from, to);
    } catch (err) {
      console.error(`Error processing blocks ${from}-${to}:`, err);
      // Retry with exponential backoff
      await new Promise((r) => setTimeout(r, 5000));
      try {
        await processBlockRange(from, to);
      } catch (retryErr) {
        console.error(`Retry failed for blocks ${from}-${to}:`, retryErr);
      }
    }
  }

  console.log(`✅ Backfill complete up to block ${currentBlock}`);
  return currentBlock;
}

async function metadataWorker() {
  const pending = await getNFTsPendingMetadata(20);
  for (const { contract, token_id } of pending) {
    await fetchTokenMetadata(contract, token_id);
    // Small delay to avoid hammering IPFS
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function pollLoop() {
  let lastBlock = await getLastIndexedBlock();

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock > lastBlock) {
        await processBlockRange(lastBlock + 1, currentBlock);
        lastBlock = currentBlock;
      }
    } catch (err) {
      console.error("Poll error:", err);
    }
  }, POLL_INTERVAL);

  // Metadata worker runs every 10s
  setInterval(metadataWorker, 10000);
}

// ──────────────────────────────────────────────
//  Main
// ──────────────────────────────────────────────

export async function startIndexer() {
  console.log("🚀 RitualPad Indexer starting...");
  console.log(`   RPC: ${RPC_URL}`);
  console.log(`   Factory: ${FACTORY_ADDRESS}`);
  console.log(`   Poll interval: ${POLL_INTERVAL}ms`);

  await backfill();
  await pollLoop();

  console.log("🟢 Indexer is running");
}

// Run directly
if (require.main === module) {
  startIndexer().catch((err) => {
    console.error("Indexer failed:", err);
    process.exit(1);
  });
}
