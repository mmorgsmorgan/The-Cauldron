import { MerkleTree } from "merkletreejs";
import { keccak256, solidityPackedKeccak256 } from "ethers";

// In-memory store of merkle trees keyed by root hash
const treeStore = new Map<string, { tree: MerkleTree; addresses: string[] }>();

// Hash an address the same way Solidity does: keccak256(abi.encodePacked(address))
function hashAddress(addr: string): string {
  return solidityPackedKeccak256(["address"], [addr]);
}

/**
 * Build a Merkle tree from a list of addresses.
 * Returns the root hash and stores the tree for proof lookups.
 */
export function generateMerkleTree(addresses: string[]): {
  root: string;
  count: number;
} {
  const normalized = addresses.map((a) => a.toLowerCase().trim());
  const leaves = normalized.map((a) => hashAddress(a));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getHexRoot();

  treeStore.set(root, { tree, addresses: normalized });

  return { root, count: normalized.length };
}

/**
 * Get the Merkle proof for a specific address under a given root.
 */
export function getMerkleProof(
  root: string,
  address: string
): { proof: string[]; valid: boolean } | null {
  const entry = treeStore.get(root);
  if (!entry) return null;

  const normalized = address.toLowerCase().trim();
  const leaf = hashAddress(normalized);
  const proof = entry.tree.getHexProof(leaf);
  const valid = entry.tree.verify(proof, leaf, root);

  return { proof, valid };
}

/**
 * Check if a root exists in the store.
 */
export function hasTree(root: string): boolean {
  return treeStore.has(root);
}

/**
 * Parse a CSV string of addresses (one per line or comma-separated).
 */
export function parseAddressCSV(csvContent: string): string[] {
  return csvContent
    .split(/[,\n\r]+/)
    .map((a) => a.trim())
    .filter((a) => a.length > 0 && a.startsWith("0x"));
}
