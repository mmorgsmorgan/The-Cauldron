import { FastifyInstance } from "fastify";
import { getCollections, getCollectionByAddress, getCollectionTokens } from "../db/queries";

export default async function collectionRoutes(app: FastifyInstance) {
  /**
   * GET /collections
   * Returns all known collections on the chain.
   */
  app.get("/collections", async () => {
    const collections = await getCollections();
    return { total: collections.length, collections };
  });

  /**
   * GET /collections/:address
   * Returns a single collection by contract address.
   */
  app.get<{ Params: { address: string } }>(
    "/collections/:address",
    async (request, reply) => {
      const { address } = request.params;

      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return reply.status(400).send({ error: "Invalid contract address format" });
      }

      const collection = await getCollectionByAddress(address);
      if (!collection) {
        return reply.status(404).send({ error: "Collection not found" });
      }
      return collection;
    }
  );

  /**
   * GET /collections/:address/tokens
   * Returns all tokens in a collection.
   */
  app.get<{ Params: { address: string } }>(
    "/collections/:address/tokens",
    async (request, reply) => {
      const { address } = request.params;

      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return reply.status(400).send({ error: "Invalid contract address format" });
      }

      const tokens = await getCollectionTokens(address);
      return { contract: address.toLowerCase(), total: tokens.length, tokens };
    }
  );
}
