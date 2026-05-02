import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import dotenv from "dotenv";

import nftRoutes from "./routes/nfts";
import collectionRoutes from "./routes/collections";
import listingRoutes from "./routes/listings";
import merkleRoutes from "./routes/merkle";
import { startIndexer } from "./indexer/index";
import { ensureSchema } from "./db/ensureSchema";

dotenv.config();

const PORT = parseInt(process.env.API_PORT || "3001");
const HOST = process.env.API_HOST || "0.0.0.0";

async function main() {
  const app = Fastify({
    logger: {
      level: "info",
    },
  });

  // Plugins
  await app.register(cors, { origin: true });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // Health check
  app.get("/health", async () => ({
    status: "ok",
    chain: "ritual",
    chainId: 1979,
    timestamp: new Date().toISOString(),
  }));

  // API routes
  await app.register(nftRoutes);
  await app.register(collectionRoutes);
  await app.register(listingRoutes);
  await app.register(merkleRoutes);

  // Start server
  await app.listen({ port: PORT, host: HOST });
  console.log(`\n🚀 RitualPad API running on http://${HOST}:${PORT}`);

  // Auto-initialize database tables
  try {
    await ensureSchema();
    console.log("✅ Database schema ready");
  } catch (err) {
    console.error("⚠️  Database schema init failed (API still running):", err);
  }

  // Start indexer in background
  try {
    await startIndexer();
  } catch (err) {
    console.error("⚠️  Indexer failed to start (API still running):", err);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
