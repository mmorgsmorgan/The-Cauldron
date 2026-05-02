"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchWalletNFTs, fetchCollections, fetchCollection, fetchListings } from "@/lib/api";

export function useWalletNFTs(address: string | undefined, verified?: boolean) {
  return useQuery({
    queryKey: ["wallet-nfts", address, verified],
    queryFn: () => fetchWalletNFTs(address!, verified),
    enabled: !!address,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useCollections() {
  return useQuery({
    queryKey: ["collections"],
    queryFn: fetchCollections,
    staleTime: 30_000,
  });
}

export function useCollection(address: string) {
  return useQuery({
    queryKey: ["collection", address],
    queryFn: () => fetchCollection(address),
    enabled: !!address,
    staleTime: 30_000,
  });
}

export function useListings(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ["listings", limit, offset],
    queryFn: () => fetchListings(limit, offset),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}
