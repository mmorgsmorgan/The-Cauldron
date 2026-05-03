import { FastifyInstance } from "fastify";
import {
  generateMerkleTree,
  getMerkleProof,
  parseAddressCSV,
} from "../services/merkleService";

// ── Security Constants ──
const MAX_ADDRESSES = 10000;        // Max allowlist size
const MAX_CSV_LENGTH = 500000;      // Max CSV string length (~500KB)
const MERKLE_RATE_LIMIT = 10;       // Max merkle generations per minute per IP

export default async function merkleRoutes(app: FastifyInstance) {
  /**
   * POST /merkle/generate
   * Body: { addresses: string[] } or { csv: string }
   * Returns: { root: string, count: number }
   * 
   * Security: Rate limited to 10 req/min, max 10,000 addresses,
   * API key required in production.
   */
  app.post<{
    Body: { addresses?: string[]; csv?: string };
  }>("/merkle/generate", {
    config: {
      rateLimit: {
        max: MERKLE_RATE_LIMIT,
        timeWindow: "1 minute",
      },
    },
    preHandler: (app as any).verifyApiKey,
  }, async (request, reply) => {
    let addresses: string[] = [];

    if (request.body.addresses && Array.isArray(request.body.addresses)) {
      // Validate array size
      if (request.body.addresses.length > MAX_ADDRESSES) {
        return reply.status(400).send({
          error: `Too many addresses. Maximum is ${MAX_ADDRESSES}, received ${request.body.addresses.length}`,
        });
      }
      addresses = request.body.addresses;
    } else if (request.body.csv) {
      // Validate CSV size
      if (request.body.csv.length > MAX_CSV_LENGTH) {
        return reply.status(400).send({
          error: `CSV too large. Maximum is ${MAX_CSV_LENGTH} characters`,
        });
      }
      addresses = parseAddressCSV(request.body.csv);
    } else {
      return reply
        .status(400)
        .send({ error: "Provide 'addresses' array or 'csv' string" });
    }

    // Validate each address format (must be 0x + 40 hex chars)
    const validAddresses = addresses.filter(
      (a) => /^0x[0-9a-fA-F]{40}$/.test(a)
    );

    if (validAddresses.length === 0) {
      return reply.status(400).send({ error: "No valid Ethereum addresses provided" });
    }

    if (validAddresses.length !== addresses.length) {
      app.log.warn(
        `Merkle generate: filtered ${addresses.length - validAddresses.length} invalid addresses`
      );
    }

    const result = generateMerkleTree(validAddresses);
    return result;
  });

  /**
   * GET /merkle/:root/:address
   * Returns the Merkle proof for a specific address.
   */
  app.get<{
    Params: { root: string; address: string };
  }>("/merkle/:root/:address", async (request, reply) => {
    const { root, address } = request.params;

    // Validate params
    if (!/^0x[0-9a-fA-F]{64}$/.test(root)) {
      return reply.status(400).send({ error: "Invalid merkle root format" });
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return reply.status(400).send({ error: "Invalid address format" });
    }

    const result = getMerkleProof(root, address);

    if (!result) {
      return reply
        .status(404)
        .send({ error: "Merkle tree not found for this root" });
    }

    return result;
  });
}
