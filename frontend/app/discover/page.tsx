"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { useState, useEffect } from "react";
import { FACTORY_ADDRESS, NFTFactory_ABI, AIRitualNFT_ABI } from "@/lib/contracts";
import { resolveIPFSGateway, raceIPFSFetchJSON } from "@/lib/pinata";
import Link from "next/link";

const NFT_ABI = [
  ...AIRitualNFT_ABI,
  { inputs: [], name: "name", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "baseURI", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
] as const;

// Individual discover card with its own IPFS cover fetch
function DiscoverCard({ c }: { c: { addr: string; name: string; symbol: string; minted: number; supply: number; phases: number; onChainURI: string; progress: number } }) {
  const [coverImage, setCoverImage] = useState("");
  const remaining = c.supply - c.minted;

  useEffect(() => {
    if (!c.onChainURI) return;
    // Single-image: baseURI is the image CID itself (no trailing slash)
    if (!c.onChainURI.endsWith("/")) {
      setCoverImage(resolveIPFSGateway(c.onChainURI));
      return;
    }
    // Try cover metadata (token 0), fallback to token 1
    raceIPFSFetchJSON(c.onChainURI + "0").then(json => {
      if (json?.image) { setCoverImage(resolveIPFSGateway(json.image)); return; }
      raceIPFSFetchJSON(c.onChainURI + "1").then(j => {
        if (j?.image) setCoverImage(resolveIPFSGateway(j.image));
      });
    });
  }, [c.onChainURI]);

  return (
    <div className="glass-card overflow-hidden group transition-all hover:scale-[1.02] hover:shadow-2xl">
      <Link href={`/mint/${c.addr}`}>
        <div className="relative aspect-video overflow-hidden cursor-pointer" style={{ background: "rgba(200,247,197,0.04)" }}>
          {coverImage ? (
            <img src={coverImage} alt={c.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className="w-full h-full flex items-center justify-center shimmer-bg">
              <span className="font-display font-black text-5xl" style={{ color: "rgba(200,247,197,0.06)" }}>
                {c.symbol?.slice(0, 2) || "??"}
              </span>
            </div>
          )}
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider"
            style={{ background: "rgba(4,15,10,0.75)", color: "var(--mint)", backdropFilter: "blur(8px)", border: "1px solid rgba(200,247,197,0.15)" }}>
            {remaining} LEFT
          </div>
        </div>
      </Link>
      <div className="p-5 space-y-4">
        <div>
          <h3 className="font-display font-black text-lg" style={{ color: "var(--mint)" }}>{c.name || "Loading..."}</h3>
          <p className="text-xs font-mono mt-0.5" style={{ color: "rgba(200,247,197,0.25)" }}>{c.symbol}</p>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold" style={{ color: "rgba(200,247,197,0.3)" }}>
            <span>{c.minted} / {c.supply} minted</span>
            <span>{c.phases} phase{c.phases !== 1 ? "s" : ""}</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: "rgba(200,247,197,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${c.progress}%`, background: "var(--mint)", boxShadow: "0 0 8px rgba(200,247,197,0.3)" }} />
          </div>
        </div>
        <Link href={`/mint/${c.addr}`} className="block w-full text-center py-3 rounded-xl text-xs font-black tracking-wider btn-primary">
          MINT NOW
        </Link>
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  // Get all collections
  const { data: allCollections, isLoading } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: NFTFactory_ABI,
    functionName: "getAllCollections",
  });
  const collections = (allCollections as `0x${string}`[]) ?? [];

  // Batch read per collection
  const infoCalls = collections.flatMap(addr => [
    { address: addr, abi: NFT_ABI, functionName: "name" },
    { address: addr, abi: NFT_ABI, functionName: "symbol" },
    { address: addr, abi: NFT_ABI, functionName: "totalSupply" },
    { address: addr, abi: NFT_ABI, functionName: "maxSupply" },
    { address: addr, abi: AIRitualNFT_ABI, functionName: "totalPhases" },
    { address: addr, abi: NFT_ABI, functionName: "baseURI" },
  ]);
  const { data: infoData } = useReadContracts({
    contracts: infoCalls as any[],
    query: { enabled: collections.length > 0 },
  });

  // Build collection data and filter to MINTABLE only
  const mintableCollections = collections
    .map((addr, i) => {
      const base = i * 6;
      const name = infoData?.[base]?.result as string ?? "";
      const symbol = infoData?.[base + 1]?.result as string ?? "";
      const minted = Number(infoData?.[base + 2]?.result ?? 0n);
      const supply = Number(infoData?.[base + 3]?.result ?? 0n);
      const phases = Number(infoData?.[base + 4]?.result ?? 0n);
      const onChainURI = infoData?.[base + 5]?.result as string ?? "";
      const progress = supply > 0 ? Math.min((minted / supply) * 100, 100) : 0;
      const isSoldOut = supply > 0 && minted >= supply;
      return { addr, name, symbol, minted, supply, phases, onChainURI, progress, isSoldOut };
    })
    .filter(c => !c.isSoldOut);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="font-display font-black text-5xl tracking-tight" style={{ color: "var(--mint)" }}>DISCOVER</h1>
          <p className="mt-2 text-sm" style={{ color: "rgba(200,247,197,0.3)" }}>
            Find new NFT collections and mint them
          </p>
        </div>
        <div className="px-4 py-2 rounded-xl text-sm font-bold"
          style={{ background: "rgba(200,247,197,0.06)", color: "rgba(200,247,197,0.4)" }}>
          {mintableCollections.length} AVAILABLE
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card animate-pulse" style={{ height: 380 }}>
              <div className="h-52 rounded-t-2xl" style={{ background: "rgba(200,247,197,0.04)" }} />
              <div className="p-5 space-y-3">
                <div className="h-5 rounded w-2/3" style={{ background: "rgba(200,247,197,0.05)" }} />
                <div className="h-3 rounded w-1/2" style={{ background: "rgba(200,247,197,0.03)" }} />
              </div>
            </div>
          ))}
        </div>
      ) : mintableCollections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="font-display font-black text-5xl" style={{ color: "rgba(200,247,197,0.06)" }}>--</div>
          <p className="font-bold" style={{ color: "rgba(200,247,197,0.2)" }}>All collections are sold out</p>
          <p className="text-xs" style={{ color: "rgba(200,247,197,0.1)" }}>Check Collections to browse and trade existing NFTs</p>
          <Link href="/collections" className="btn-primary px-6 py-3 text-xs font-black mt-2">
            VIEW COLLECTIONS
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mintableCollections.map(c => (
            <DiscoverCard key={c.addr} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
