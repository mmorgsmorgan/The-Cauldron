/**
 * Ritual Names Resolver
 * 
 * Fetches name→address mappings from https://ritual-names.vercel.app/api/names
 * Provides O(1) lookup, automatic refresh every 6 hours, and graceful fallback.
 */

const NAMES_API = "https://ritual-names.vercel.app/api/names";
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const LIGHT_REFRESH_MS = 5 * 60 * 1000;           // 5 minutes
const STORAGE_KEY = "ritual_names_cache";
const STORAGE_TS_KEY = "ritual_names_cache_ts";

// address (lowercase) → first registered name
let nameMap: Map<string, string> = new Map();
let lastFetched = 0;
let fetchPromise: Promise<void> | null = null;

interface RitualName {
  label: string;
  owner: string;
  tokenId: string;
}

interface NamesResponse {
  names: RitualName[];
}

/** Normalize address to lowercase for consistent lookup */
function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

/** Shortened address fallback: 0x1234...5678 */
function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Load names from localStorage cache (for SSR safety) */
function loadFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const ts = localStorage.getItem(STORAGE_TS_KEY);
    const data = localStorage.getItem(STORAGE_KEY);
    if (!ts || !data) return false;
    
    const age = Date.now() - parseInt(ts, 10);
    if (age > REFRESH_INTERVAL_MS) return false; // stale
    
    const entries: [string, string][] = JSON.parse(data);
    nameMap = new Map(entries);
    lastFetched = parseInt(ts, 10);
    return true;
  } catch {
    return false;
  }
}

/** Persist to localStorage */
function saveToStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...nameMap]));
    localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
  } catch {
    // storage quota exceeded — ignore
  }
}

/** Fetch and index names from the API */
async function fetchNames(): Promise<void> {
  try {
    const res = await fetch(NAMES_API, { cache: "no-store" });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data: NamesResponse = await res.json();
    
    // Build map — first name per address wins (earliest tokenId)
    const newMap = new Map<string, string>();
    // Sort by tokenId ascending so "first registered" name takes priority
    const sorted = [...data.names].sort((a, b) => 
      BigInt(a.tokenId) < BigInt(b.tokenId) ? -1 : 1
    );
    for (const { label, owner } of sorted) {
      const key = normalizeAddress(owner);
      if (!newMap.has(key)) {
        newMap.set(key, label);
      }
    }
    
    nameMap = newMap;
    lastFetched = Date.now();
    saveToStorage();
  } catch (err) {
    console.warn("[RitualNames] Fetch failed, using cached data:", err);
  }
}

/** Initialize — loads cache then fetches fresh data in background */
async function init(): Promise<void> {
  if (fetchPromise) return fetchPromise;
  
  // Try cache first (instant)
  loadFromStorage();
  
  // Fetch fresh data in background
  fetchPromise = fetchNames().finally(() => {
    fetchPromise = null;
  });
  
  return fetchPromise;
}

/** Trigger a background refresh if stale */
function maybeRefresh(): void {
  const age = Date.now() - lastFetched;
  if (age > LIGHT_REFRESH_MS && !fetchPromise) {
    fetchPromise = fetchNames().finally(() => {
      fetchPromise = null;
    });
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve an address to a Ritual Name.
 * Returns the name if found, otherwise returns a shortened address.
 * Never returns empty string.
 */
export function resolve(address: string | undefined | null): string {
  if (!address) return "unknown";
  maybeRefresh();
  const key = normalizeAddress(address);
  return nameMap.get(key) ?? shortenAddress(address);
}

/**
 * Resolve an address to a name only (returns null if no name registered).
 * Use this when you want to conditionally show a name vs. address.
 */
export function resolveName(address: string | undefined | null): string | null {
  if (!address) return null;
  maybeRefresh();
  const key = normalizeAddress(address);
  return nameMap.get(key) ?? null;
}

/**
 * Check if an address has a registered name.
 */
export function hasName(address: string): boolean {
  return nameMap.has(normalizeAddress(address));
}

/**
 * Get the current size of the name registry.
 */
export function registrySize(): number {
  return nameMap.size;
}

/**
 * Force a full refresh from the API.
 */
export async function refresh(): Promise<void> {
  if (!fetchPromise) {
    fetchPromise = fetchNames().finally(() => {
      fetchPromise = null;
    });
  }
  return fetchPromise;
}

/**
 * Load names — call this once at app startup (in providers).
 */
export async function loadNames(): Promise<void> {
  return init();
}

export { shortenAddress };
