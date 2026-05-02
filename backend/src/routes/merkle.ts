import { FastifyInstance } from "fastify";
import {
  generateMerkleTree,
  getMerkleProof,
  parseAddressCSV,
} from "../services/merkleService";

export default async function merkleRoutes(app: FastifyInstance) {
  /**
   * POST /merkle/generate
   * Body: { addresses: string[] } or { csv: string }
   * Returns: { root: string, count: number }
   */
  app.post<{
    Body: { addresses?: string[]; csv?: string };
  }>("/merkle/generate", async (request, reply) => {
    let addresses: string[] = [];

    if (request.body.addresses && Array.isArray(request.body.addresses)) {
      addresses = request.body.addresses;
    } else if (request.body.csv) {
      addresses = parseAddressCSV(request.body.csv);
    } else {
      return reply
        .status(400)
        .send({ error: "Provide 'addresses' array or 'csv' string" });
    }

    if (addresses.length === 0) {
      return reply.status(400).send({ error: "No valid addresses provided" });
    }

    const result = generateMerkleTree(addresses);
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
    const result = getMerkleProof(root, address);

    if (!result) {
      return reply
        .status(404)
        .send({ error: "Merkle tree not found for this root" });
    }

    return result;
  });
}
