"use client";

import { useReadContracts, useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { AIRitualNFT_ABI, NFTFactory_ABI, FACTORY_ADDRESS } from "@/lib/contracts";

const NFT_ABI_EXT = [
  ...AIRitualNFT_ABI,
  { inputs: [], name: "name", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "owner", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "owner", type: "address" }], name: "tokensOfOwner", outputs: [{ name: "", type: "uint256[]" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "baseURI", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
] as const;

export interface OwnedNFTEntry {
  contract: string;
  tokenId: number;
  name: string;
  collectionName: string;
  symbol: string;
  baseURI: string;
  isMultiImage: boolean;
}

/**
 * useNFTOwnership - Lightweight caching indexer for wallet NFT ownership.
 *
 * Strategy:
 * - Batch reads ALL collections in ONE multicall (name, symbol, baseURI, tokensOfOwner)
 * - React Query caches results for 60s — no duplicate RPC calls on re-renders
 * - Stale data shown instantly while revalidating in background
 */
export function useNFTOwnership(walletAddress: string | undefined) {
  // Step 1: get all collection addresses (cached 2 min)
  const { data: allCollections } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: NFTFactory_ABI,
    functionName: "getAllCollections",
    query: { enabled: !!walletAddress, staleTime: 120_000 },
  });
  const collections = (allCollections as `0x${string}`[]) ?? [];

  // Step 2: batch multicall — 4 reads per collection in ONE request
  const calls = walletAddress
    ? collections.flatMap((addr) => [
        { address: addr, abi: NFT_ABI_EXT, functionName: "name" },
        { address: addr, abi: NFT_ABI_EXT, functionName: "symbol" },
        { address: addr, abi: NFT_ABI_EXT, functionName: "baseURI" },
        { address: addr, abi: NFT_ABI_EXT, functionName: "tokensOfOwner", args: [walletAddress] },
      ])
    : [];

  const { data: batchData, isLoading } = useReadContracts({
    contracts: calls as any[],
    query: {
      enabled: !!walletAddress && collections.length > 0,
      staleTime: 60_000,   // cache 60s — no RPC spam on re-renders
      gcTime: 300_000,     // keep in memory 5 min
    },
  });

  // Step 3: flatten into OwnedNFTEntry[] using React Query for stable reference
  const { data: ownedNFTs = [] } = useQuery({
    queryKey: ["nft-ownership", walletAddress, collections.join(","), batchData?.length],
    queryFn: (): OwnedNFTEntry[] => {
      if (!batchData || !walletAddress) return [];
      const result: OwnedNFTEntry[] = [];
      collections.forEach((addr, i) => {
        const base = i * 4;
        const name = batchData[base]?.result as string ?? "";
        const symbol = batchData[base + 1]?.result as string ?? "";
        const baseURI = batchData[base + 2]?.result as string ?? "";
        const tokenIds = batchData[base + 3]?.result as bigint[] ?? [];
        if (!tokenIds.length) return;
        const isMultiImage = baseURI.endsWith("/");
        for (const tid of tokenIds) {
          result.push({
            contract: addr,
            tokenId: Number(tid),
            name: name ? `${name} #${Number(tid)}` : `#${Number(tid)}`,
            collectionName: name,
            symbol,
            baseURI,
            isMultiImage,
          });
        }
      });
      return result;
    },
    enabled: !!batchData && !!walletAddress,
    staleTime: 60_000,
    placeholderData: (prev) => prev, // show stale data while revalidating
  });

  return { ownedNFTs, isLoading, collectionCount: collections.length };
}
