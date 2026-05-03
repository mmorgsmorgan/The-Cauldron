import { FastifyInstance } from "fastify";
import { getActiveListings, getListingsBySeller } from "../db/queries";

// ── Security Constants ──
const MAX_LIMIT = 200;  // Max listings per page

export default async function listingRoutes(app: FastifyInstance) {
  /**
   * GET /listings
   * Returns active marketplace listings.
   * Query params: seller=0x... to filter by seller, limit (max 200), offset
   */
  app.get<{
    Querystring: { seller?: string; limit?: string; offset?: string };
  }>("/listings", async (request, reply) => {
    const { seller, limit, offset } = request.query;

    if (seller) {
      if (!/^0x[0-9a-fA-F]{40}$/.test(seller)) {
        return reply.status(400).send({ error: "Invalid seller address format" });
      }
      const listings = await getListingsBySeller(seller);
      return { total: listings.length, listings };
    }

    const l = Math.min(parseInt(limit || "50"), MAX_LIMIT);
    const o = Math.max(parseInt(offset || "0"), 0);
    const listings = await getActiveListings(l, o);
    return { total: listings.length, listings };
  });
}
