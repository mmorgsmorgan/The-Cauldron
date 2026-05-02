"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FACTORY_ADDRESS, NFTFactory_ABI, AIRitualNFT_ABI } from "@/lib/contracts";
import { resolveIPFSGateway } from "@/lib/pinata";
import Link from "next/link";

const EXTENDED_ABI = [
  ...AIRitualNFT_ABI,
  { inputs: [], name: "name", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "baseURI", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
] as const;

export default function MyCollectionsPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [localMetas, setLocalMetas] = useState<Record<string, { image?: string }>>({});

  const { data: collections, isLoading } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: NFTFactory_ABI,
    functionName: "getCollectionsByOwner",
    args: [address!],
    query: { enabled: !!address },
  });

  const collectionAddresses = (collections as `0x${string}`[]) ?? [];

  // Batch read name + symbol + totalSupply + maxSupply + totalPhases
  const calls = collectionAddresses.flatMap(addr => [
    { address: addr, abi: EXTENDED_ABI, functionName: "name" },
    { address: addr, abi: EXTENDED_ABI, functionName: "symbol" },
    { address: addr, abi: EXTENDED_ABI, functionName: "totalSupply" },
    { address: addr, abi: EXTENDED_ABI, functionName: "maxSupply" },
    { address: addr, abi: EXTENDED_ABI, functionName: "totalPhases" },
    { address: addr, abi: EXTENDED_ABI, functionName: "baseURI" },
  ]);

  const { data: batchData } = useReadContracts({ contracts: calls as any[], query: { enabled: collectionAddresses.length > 0 } });

  // Load locally cached metadata
  useEffect(() => {
    const metas: Record<string, { image?: string }> = {};
    for (const addr of collectionAddresses) {
      try {
        const saved = localStorage.getItem(`cauldron_meta_${addr.toLowerCase()}`);
        if (saved) metas[addr.toLowerCase()] = JSON.parse(saved);
      } catch {}
    }
    setLocalMetas(metas);
  }, [collectionAddresses.length]);

  if (!isConnected) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="font-display font-black text-2xl" style={{ color: "rgba(200,247,197,0.3)" }}>Connect your wallet to view your collections</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 animate-fade-in">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-display font-black text-4xl" style={{ color: "var(--mint)" }}>MY COLLECTIONS</h1>
          <p className="text-xs mt-2" style={{ color: "rgba(200,247,197,0.3)" }}>Collections you have deployed on The Cauldron</p>
        </div>
        <Link href={`/profile/${address}?tab=deploy`}
          className="btn-primary px-6 py-3 text-xs font-black">
          + DEPLOY NEW
        </Link>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-6 animate-pulse space-y-3">
              <div className="rounded-2xl aspect-square" style={{ background: "rgba(200,247,197,0.04)" }} />
              <div className="h-4 rounded" style={{ background: "rgba(200,247,197,0.04)" }} />
              <div className="h-3 rounded w-2/3" style={{ background: "rgba(200,247,197,0.04)" }} />
            </div>
          ))}
        </div>
      ) : collectionAddresses.length === 0 ? (
        <div className="glass-card p-16 text-center space-y-4">
          <div className="font-display font-black text-2xl" style={{ color: "rgba(200,247,197,0.2)" }}>NO COLLECTIONS YET</div>
          <p className="text-sm" style={{ color: "rgba(200,247,197,0.2)" }}>Deploy your first collection to see it here</p>
          <Link href={`/profile/${address}?tab=deploy`} className="btn-primary inline-block px-8 py-3 text-sm font-black mt-4">
            DEPLOY COLLECTION
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {collectionAddresses.map((addr, i) => {
            const base = i * 6;
            const name = batchData?.[base]?.result as string ?? "";
            const symbol = batchData?.[base + 1]?.result as string ?? "";
            const supplyBig = batchData?.[base + 3]?.result as bigint ?? 0n;
            const rawMintedBig = batchData?.[base + 2]?.result as bigint ?? 0n;
            const mintedBig = (supplyBig > 0n && rawMintedBig > supplyBig) ? 0n : rawMintedBig;
            const minted = Number(mintedBig);
            const supply = Number(supplyBig);
            const phaseCount = Number(batchData?.[base + 4]?.result ?? 0n);
            const onChainURI = batchData?.[base + 5]?.result as string ?? "";
            const meta = localMetas[addr.toLowerCase()];
            const rawImage = meta?.image || onChainURI || "";
            const imageUrl = rawImage ? resolveIPFSGateway(rawImage) : "";
            const progress = supply > 0 ? (minted / supply) * 100 : 0;

            return (
              <div key={addr} className="glass-card overflow-hidden group cursor-pointer transition-all hover:scale-[1.02]"
                onClick={() => router.push(`/mint/${addr}`)}>
                {/* Image */}
                <div className="aspect-square overflow-hidden" style={{ background: "rgba(200,247,197,0.04)" }}>
                  {imageUrl ? (
                    <img src={imageUrl} alt={name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="font-display font-black text-4xl" style={{ color: "rgba(200,247,197,0.1)" }}>
                        {symbol.slice(0, 2) || "??"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <div className="font-display font-black text-lg" style={{ color: "var(--mint)" }}>{name || "..."}</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: "rgba(200,247,197,0.25)" }}>{symbol}</div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold" style={{ color: "rgba(200,247,197,0.3)" }}>
                      <span>MINTED</span>
                      <span>{minted} / {supply}</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "rgba(200,247,197,0.06)" }}>
                      <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "var(--mint)" }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-mono px-2 py-1 rounded-lg" style={{ background: "rgba(200,247,197,0.04)", color: "rgba(200,247,197,0.3)" }}>
                      {phaseCount} PHASE{phaseCount !== 1 ? "S" : ""}
                    </div>
                    <div className="text-[10px] font-mono" style={{ color: "rgba(200,247,197,0.2)" }}>
                      {addr.slice(0, 6)}...{addr.slice(-4)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Link href={`/mint/${addr}`}
                      className="text-center py-2 rounded-xl text-[10px] font-black tracking-wider transition-all"
                      style={{ background: "rgba(200,247,197,0.08)", color: "var(--mint)" }}
                      onClick={e => e.stopPropagation()}>
                      VIEW MINT
                    </Link>
                    <a href={`https://sepolia.basescan.org/address/${addr}`} target="_blank" rel="noopener noreferrer"
                      className="text-center py-2 rounded-xl text-[10px] font-black tracking-wider transition-all"
                      style={{ background: "rgba(200,247,197,0.04)", color: "rgba(200,247,197,0.3)" }}
                      onClick={e => e.stopPropagation()}>
                      EXPLORER
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
