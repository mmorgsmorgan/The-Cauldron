import { FastifyInstance } from "fastify";
import { getActiveListings, getListingsBySeller } from "../db/queries";

export default async function listingRoutes(app: FastifyInstance) {
  /**
   * GET /listings
   * Returns active marketplace listings.
   * Query params: seller=0x... to filter by seller, limit, offset
   */
  app.get<{
    Querystring: { seller?: string; limit?: string; offset?: string };
  }>("/listings", async (request) => {
    const { seller, limit, offset } = request.query;

    if (seller) {
      const listings = await getListingsBySeller(seller);
      return { total: listings.length, listings };
    }

    const l = parseInt(limit || "50");
    const o = parseInt(offset || "0");
    const listings = await getActiveListings(l, o);
    return { total: listings.length, listings };
  });
}
