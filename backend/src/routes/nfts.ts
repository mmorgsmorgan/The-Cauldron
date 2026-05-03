import { FastifyInstance } from "fastify";
import { getNFTsByOwner } from "../db/queries";

export default async function nftRoutes(app: FastifyInstance) {
  /**
   * GET /user/:address/nfts
   * Returns all NFTs owned by an address across the entire Ritual Chain.
   * Query params: verified=true to filter to factory-deployed collections only.
   */
  app.get<{
    Params: { address: string };
    Querystring: { verified?: string };
  }>("/user/:address/nfts", async (request, reply) => {
    const { address } = request.params;
    const verifiedOnly = request.query.verified === "true";

    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return reply.status(400).send({ error: "Invalid Ethereum address format" });
    }

    const nfts = await getNFTsByOwner(address, verifiedOnly);

    return {
      address: address.toLowerCase(),
      total: nfts.length,
      nfts: nfts.map((n: any) => ({
        contract: n.contract,
        tokenId: n.token_id,
        owner: n.owner,
        metadataStatus: n.metadata_status,
        name: n.metadata?.name || null,
        image: n.metadata?.image || null,
        description: n.metadata?.description || null,
        attributes: n.metadata?.attributes || [],
        tokenUri: n.token_uri,
        isVerified: n.is_verified || false,
        collectionName: n.collection_name || null,
        collectionSymbol: n.collection_symbol || null,
        lastUpdated: n.last_updated,
      })),
    };
  });
}
