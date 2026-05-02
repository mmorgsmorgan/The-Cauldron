const PINATA_KEYS = [
  process.env.NEXT_PUBLIC_PINATA_JWT_1,
  process.env.NEXT_PUBLIC_PINATA_JWT_2,
  process.env.NEXT_PUBLIC_PINATA_JWT_3,
].filter(Boolean) as string[];

let currentKeyIndex = 0;

function getNextKey(): string {
  if (!PINATA_KEYS.length) throw new Error("No Pinata keys configured");
  const key = PINATA_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % PINATA_KEYS.length;
  return key;
}

export async function uploadToPinata(file: File): Promise<string> {
  let lastError: Error | null = null;

  // Try each key until one works
  for (let i = 0; i < PINATA_KEYS.length; i++) {
    const jwt = getNextKey();
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("pinataMetadata", JSON.stringify({ name: file.name }));

      const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
        body: formData,
      });

      if (res.status === 429 || res.status === 403) {
        // Rate limited or storage full — try next key
        lastError = new Error(`Key ${i + 1}: ${res.status} ${res.statusText}`);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        lastError = new Error(`Pinata error: ${res.status} - ${text}`);
        continue;
      }

      const data = await res.json();
      return `ipfs://${data.IpfsHash}`;
    } catch (err) {
      lastError = err as Error;
      continue;
    }
  }

  throw lastError || new Error("All Pinata keys failed");
}

export async function uploadJSONToPinata(json: object, name: string): Promise<string> {
  let lastError: Error | null = null;

  for (let i = 0; i < PINATA_KEYS.length; i++) {
    const jwt = getNextKey();
    try {
      const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          pinataContent: json,
          pinataMetadata: { name },
        }),
      });

      if (res.status === 429 || res.status === 403) {
        lastError = new Error(`Key ${i + 1}: ${res.status}`);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        lastError = new Error(`Pinata error: ${res.status} - ${text}`);
        continue;
      }

      const data = await res.json();
      return `ipfs://${data.IpfsHash}`;
    } catch (err) {
      lastError = err as Error;
      continue;
    }
  }

  throw lastError || new Error("All Pinata keys failed");
}

const IPFS_GATEWAYS = [
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://w3s.link/ipfs/",
];

const IPFS_GATEWAY = IPFS_GATEWAYS[0];

export function resolveIPFSGateway(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return `${IPFS_GATEWAY}${uri.slice(7)}`;
  }
  return uri;
}

/**
 * Resolve an IPFS URI to a list of gateway URLs for racing.
 */
function resolveAllGateways(uri: string): string[] {
  if (!uri) return [];
  if (uri.startsWith("ipfs://")) {
    const path = uri.slice(7);
    return IPFS_GATEWAYS.map(gw => `${gw}${path}`);
  }
  return [uri];
}

// In-memory cache for IPFS JSON fetches (keyed by ipfs:// URI)
const ipfsJsonCache = new Map<string, any>();

/**
 * Helper: like Promise.any but compatible with ES2020 targets.
 * Resolves with the first promise that fulfills; rejects if all reject.
 */
function promiseAny<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let rejections = 0;
    const errors: any[] = [];
    for (const p of promises) {
      p.then(resolve).catch((err) => {
        errors.push(err);
        rejections++;
        if (rejections === promises.length) reject(new Error("All promises rejected"));
      });
    }
  });
}

/**
 * Race multiple IPFS gateways and return the first successful JSON response.
 * Results are cached in memory so duplicate fetches are instant.
 */
export async function raceIPFSFetchJSON(ipfsUri: string): Promise<any | null> {
  if (!ipfsUri) return null;

  // Check cache first
  if (ipfsJsonCache.has(ipfsUri)) {
    return ipfsJsonCache.get(ipfsUri);
  }

  const urls = resolveAllGateways(ipfsUri);
  if (urls.length === 0) return null;

  try {
    const result = await promiseAny(
      urls.map(async (url) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);
          if (!res.ok) throw new Error(`${res.status}`);
          return res.json();
        } catch (err) {
          clearTimeout(timeout);
          throw err;
        }
      })
    );
    // Cache the result
    ipfsJsonCache.set(ipfsUri, result);
    return result;
  } catch {
    return null;
  }
}

/**
 * Race multiple IPFS gateways and return the fastest working image URL.
 * Useful for <img> tags — returns a gateway URL that responded with 200.
 */
export async function raceIPFSImageURL(ipfsUri: string): Promise<string> {
  if (!ipfsUri) return "";
  if (!ipfsUri.startsWith("ipfs://")) return ipfsUri;

  const urls = resolveAllGateways(ipfsUri);
  try {
    const winner = await promiseAny(
      urls.map(async (url) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
          const res = await fetch(url, { method: "HEAD", signal: controller.signal });
          clearTimeout(timeout);
          if (!res.ok) throw new Error(`${res.status}`);
          return url;
        } catch (err) {
          clearTimeout(timeout);
          throw err;
        }
      })
    );
    return winner;
  } catch {
    // Fallback: return the primary gateway URL even if we couldn't verify it
    return resolveIPFSGateway(ipfsUri);
  }
}

/**
 * Upload a folder of metadata JSONs to IPFS via Pinata.
 * Each file is named by tokenId (1, 2, 3, ...).
 * Returns the folder IPFS URI: ipfs://FolderCID/
 */
export async function uploadMetadataFolderToPinata(
  items: { tokenId: number; name: string; description: string; imageCID: string }[],
  coverImageCID?: string
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < PINATA_KEYS.length; attempt++) {
    const jwt = getNextKey();
    try {
      const formData = new FormData();

      // Add cover metadata as tokenId 0 (never used by contract, acts as collection cover)
      const coverCID = coverImageCID || items[0]?.imageCID || "";
      const coverMeta = {
        name: "Collection Cover",
        description: items[0]?.description || "",
        image: coverCID,
      };
      const coverBlob = new Blob([JSON.stringify(coverMeta)], { type: "application/json" });
      formData.append("file", coverBlob, `metadata/0`);

      for (const item of items) {
        const metadata = {
          name: item.name,
          description: item.description,
          image: item.imageCID,
        };
        const blob = new Blob([JSON.stringify(metadata)], { type: "application/json" });
        // Name each file as the tokenId inside a folder
        formData.append("file", blob, `metadata/${item.tokenId}`);
      }

      formData.append("pinataMetadata", JSON.stringify({ name: `collection-metadata-${Date.now()}` }));
      formData.append("pinataOptions", JSON.stringify({ wrapWithDirectory: true }));

      const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
        body: formData,
      });

      if (res.status === 429 || res.status === 403) {
        lastError = new Error(`Key ${attempt + 1}: ${res.status}`);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        lastError = new Error(`Pinata folder error: ${res.status} - ${text}`);
        continue;
      }

      const data = await res.json();
      // The CID wraps the folder. Files are at CID/metadata/1, CID/metadata/2, etc.
      return `ipfs://${data.IpfsHash}/metadata/`;
    } catch (err) {
      lastError = err as Error;
      continue;
    }
  }

  throw lastError || new Error("All Pinata keys failed for folder upload");
}

