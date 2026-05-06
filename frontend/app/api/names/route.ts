/**
 * API Route: /api/names
 * Proxies the Ritual Names API to avoid CORS issues.
 * Client fetches from our own domain → no CORS block.
 */

const RITUAL_NAMES_API = "https://ritual-names.vercel.app/api/names";

// Cache the response for 6 hours in-memory
let cachedData: string | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function GET() {
  const now = Date.now();

  // Return cached if fresh
  if (cachedData && now - cachedAt < CACHE_TTL_MS) {
    return new Response(cachedData, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=21600", // 6 hours
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    const res = await fetch(RITUAL_NAMES_API, {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Upstream ${res.status}` }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.text();
    cachedData = data;
    cachedAt = now;

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=21600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    // If upstream fails but we have stale cache, serve it
    if (cachedData) {
      return new Response(cachedData, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Cache": "stale",
        },
      });
    }
    return new Response(JSON.stringify({ error: "Failed to fetch names" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
