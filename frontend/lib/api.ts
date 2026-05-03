const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

function getHeaders(extra?: Record<string, string>) {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) h["X-API-Key"] = API_KEY;
  return { ...h, ...extra };
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── NFTs ──
export interface NFTItem {
  contract: string;
  tokenId: string;
  owner: string;
  metadataStatus: "full" | "broken" | "unrevealed" | "pending";
  name: string | null;
  image: string | null;
  description: string | null;
  attributes: any[];
  tokenUri: string | null;
  isVerified: boolean;
  collectionName: string | null;
  collectionSymbol: string | null;
  lastUpdated: string;
}

export interface WalletNFTsResponse {
  address: string;
  total: number;
  nfts: NFTItem[];
}

export function fetchWalletNFTs(address: string, verified?: boolean) {
  const q = verified ? "?verified=true" : "";
  return apiFetch<WalletNFTsResponse>(`/user/${address}/nfts${q}`);
}

// ── Collections ──
export interface Collection {
  address: string;
  name: string;
  symbol: string;
  deployer: string;
  max_supply: number;
  base_uri: string;
  is_verified: boolean;
  created_at: string;
}

export function fetchCollections() {
  return apiFetch<{ total: number; collections: Collection[] }>("/collections");
}

export function fetchCollection(address: string) {
  return apiFetch<Collection>(`/collections/${address}`);
}

// ── Listings ──
export interface ListingItem {
  id: number;
  contract: string;
  token_id: string;
  seller: string;
  price: string;
  active: boolean;
  listed_at: string;
  collection_name: string | null;
  is_verified: boolean;
  metadata: any;
  metadata_status: string;
}

export function fetchListings(limit = 50, offset = 0) {
  return apiFetch<{ total: number; listings: ListingItem[] }>(
    `/listings?limit=${limit}&offset=${offset}`
  );
}

// ── Merkle ──
export function generateMerkleRoot(addresses: string[]) {
  return apiPost<{ root: string; count: number }>("/merkle/generate", { addresses });
}

export function fetchMerkleProof(root: string, address: string) {
  return apiFetch<{ proof: string[]; valid: boolean }>(`/merkle/${root}/${address}`);
}

// ── Utils ──
export function resolveIPFS(uri: string | null): string | null {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  return uri;
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
