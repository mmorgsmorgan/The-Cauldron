"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { FACTORY_ADDRESS, MARKETPLACE_ADDRESS, NFTFactory_ABI, AIRitualNFT_ABI, RitualMarketplace_ABI } from "@/lib/contracts";
import { useEffect, useState } from "react";
import { resolveIPFSGateway, raceIPFSFetchJSON } from "@/lib/pinata";
import Link from "next/link";

const NFT_ABI = [
  ...AIRitualNFT_ABI,
  { inputs: [], name: "name", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "baseURI", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
] as const;

export default function CollectionsPage() {

  const { data: allCollections, isLoading } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: NFTFactory_ABI,
    functionName: "getAllCollections",
  });

  const addresses = (allCollections as `0x${string}`[]) ?? [];

  // Batch read per collection
  const calls = addresses.flatMap(addr => [
    { address: addr, abi: NFT_ABI, functionName: "name" },
    { address: addr, abi: NFT_ABI, functionName: "symbol" },
    { address: addr, abi: NFT_ABI, functionName: "totalSupply" },
    { address: addr, abi: NFT_ABI, functionName: "maxSupply" },
    { address: addr, abi: AIRitualNFT_ABI, functionName: "totalPhases" },
    { address: addr, abi: NFT_ABI, functionName: "baseURI" },
  ]);

  const { data: batchData } = useReadContracts({
    contracts: calls as any[],
    query: { enabled: addresses.length > 0 },
  });

  // Build token pairs to count listings
  const allTokenPairs: { contract: `0x${string}`; tokenId: bigint; colIdx: number }[] = [];
  addresses.forEach((addr, i) => {
    const supply = Number(batchData?.[i * 6 + 2]?.result ?? 0n);
    for (let t = 1; t <= supply; t++) {
      allTokenPairs.push({ contract: addr, tokenId: BigInt(t), colIdx: i });
    }
  });

  const listingCalls = allTokenPairs.map(({ contract, tokenId }) => ({
    address: MARKETPLACE_ADDRESS,
    abi: RitualMarketplace_ABI,
    functionName: "getListing",
    args: [contract, tokenId],
  }));
  const { data: listingData } = useReadContracts({
    contracts: listingCalls as any[],
    query: { enabled: allTokenPairs.length > 0 },
  });

  // Count active listings per collection
  const listedCountByCollection: Record<string, number> = {};
  allTokenPairs.forEach((pair, i) => {
    const listing = listingData?.[i]?.result as any;
    if (listing?.active) {
      const key = pair.contract.toLowerCase();
      listedCountByCollection[key] = (listedCountByCollection[key] || 0) + 1;
    }
  });


  // Only show collections that have at least 1 mint
  const mintedCollections = addresses.filter((addr, i) => {
    const minted = Number(batchData?.[i * 6 + 2]?.result ?? 0n);
    return minted > 0;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 animate-fade-in">
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="font-display font-black text-5xl tracking-tight" style={{ color: "var(--mint)" }}>COLLECTIONS</h1>
          <p className="mt-2 text-sm" style={{ color: "rgba(200,247,197,0.3)" }}>
            View ownership, details, and trade NFTs
          </p>
        </div>
        <div className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: "rgba(200,247,197,0.06)", color: "rgba(200,247,197,0.4)" }}>
          {mintedCollections.length} COLLECTIONS
        </div>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card animate-pulse" style={{ height: 280 }}>
              <div className="h-40 rounded-t-2xl" style={{ background: "rgba(200,247,197,0.04)" }} />
              <div className="p-5 space-y-2">
                <div className="h-5 rounded w-2/3" style={{ background: "rgba(200,247,197,0.05)" }} />
                <div className="h-3 rounded w-1/2" style={{ background: "rgba(200,247,197,0.03)" }} />
              </div>
            </div>
          ))}
        </div>
      ) : mintedCollections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl" style={{ background: "rgba(200,247,197,0.05)" }}>🪄</div>
          <p className="text-lg font-semibold" style={{ color: "rgba(200,247,197,0.25)" }}>No minted collections yet</p>
          <p className="text-sm" style={{ color: "rgba(200,247,197,0.15)" }}>Mint your first NFT from Discover</p>
          <Link href="/discover" className="btn-primary px-6 py-3 text-xs font-black mt-2">GO TO DISCOVER</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {mintedCollections.map((addr) => {
            const i = addresses.indexOf(addr);
            const base = i * 6;
            const colName = batchData?.[base]?.result as string ?? "";
            const symbol = batchData?.[base + 1]?.result as string ?? "";
            const minted = Number(batchData?.[base + 2]?.result ?? 0n);
            const supply = Number(batchData?.[base + 3]?.result ?? 0n);
            const onChainURI = batchData?.[base + 5]?.result as string ?? "";
            const isSoldOut = supply > 0 && minted >= supply;
            const forSaleCount = listedCountByCollection[addr.toLowerCase()] || 0;

            return (
              <CollectionCard
                key={addr}
                addr={addr}
                name={colName}
                symbol={symbol}
                minted={minted}
                supply={supply}
                baseURI={onChainURI}
                isSoldOut={isSoldOut}
                forSaleCount={forSaleCount}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function CollectionCard({ addr, name, symbol, minted, supply, baseURI, isSoldOut, forSaleCount }: any) {
  const [coverImage, setCoverImage] = useState<string>("");

  // Race 4 IPFS gateways: try baseURI+"0" (cover metadata), fallback to baseURI+"1"
  // For single-image collections, baseURI is a raw CID — use it directly
  useEffect(() => {
    if (!baseURI) return;
    // Single-image: baseURI is the image CID itself (no trailing slash)
    if (!baseURI.endsWith("/")) {
      setCoverImage(resolveIPFSGateway(baseURI));
      return;
    }
    async function fetchCover() {
      // Try cover metadata (token 0) first
      const cover = await raceIPFSFetchJSON(baseURI + "0");
      if (cover?.image) {
        setCoverImage(resolveIPFSGateway(cover.image));
        return;
      }
      // Fallback to token 1
      const token1 = await raceIPFSFetchJSON(baseURI + "1");
      if (token1?.image) {
        setCoverImage(resolveIPFSGateway(token1.image));
      }
    }
    fetchCover();
  }, [baseURI]);

  const imageUrl = coverImage || "";

  return (
    <Link href={`/collection/${addr}`}
      className="glass-card overflow-hidden group cursor-pointer block transition-all hover:scale-[1.02] hover:shadow-2xl"
      style={{ textDecoration: "none" }}>

      {/* Cover image */}
      <div className="relative aspect-video overflow-hidden" style={{ background: "rgba(200,247,197,0.04)" }}>
        {imageUrl ? (
          <img src={imageUrl} alt={name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-display font-black text-5xl" style={{ color: "rgba(200,247,197,0.06)" }}>
              {symbol?.slice(0, 2) || "??"}
            </span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {forSaleCount > 0 && (
            <div className="px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider"
              style={{ background: "rgba(200,247,197,0.15)", color: "var(--mint)", backdropFilter: "blur(8px)" }}>
              {forSaleCount} FOR SALE
            </div>
          )}
        </div>
        {isSoldOut && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider"
            style={{ background: "rgba(4,15,10,0.7)", color: "rgba(200,247,197,0.4)", backdropFilter: "blur(8px)", border: "1px solid rgba(200,247,197,0.1)" }}>
            FULLY MINTED
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display font-black text-lg" style={{ color: "var(--mint)" }}>{name || "Loading..."}</h3>
            <p className="text-xs font-mono" style={{ color: "rgba(200,247,197,0.25)" }}>{symbol}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-5">
          {[
            { label: "MINTED", value: minted },
            { label: "SUPPLY", value: supply },
            { label: "FOR SALE", value: forSaleCount },
          ].map(s => (
            <div key={s.label}>
              <div className="font-display font-black text-xl"
                style={{ color: s.label === "FOR SALE" && s.value > 0 ? "var(--mint)" : "rgba(200,247,197,0.6)" }}>
                {s.value}
              </div>
              <div className="text-[9px] font-bold tracking-widest" style={{ color: "rgba(200,247,197,0.2)" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex gap-2">
          <div className="flex-1 text-center py-2.5 rounded-xl text-[10px] font-black tracking-wider"
            style={{ background: "rgba(200,247,197,0.08)", color: "var(--mint)" }}>
            VIEW & TRADE →
          </div>
        </div>
      </div>
    </Link>
  );
}
