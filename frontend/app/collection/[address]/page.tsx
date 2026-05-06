"use client";

import { useParams } from "next/navigation";
import { useReadContract, useReadContracts } from "wagmi";
import { useState, useEffect } from "react";
import { formatEther } from "viem";
import { MARKETPLACE_ADDRESS, RitualMarketplace_ABI, AIRitualNFT_ABI } from "@/lib/contracts";
import { resolveIPFSGateway, raceIPFSFetchJSON } from "@/lib/pinata";
import AddressDisplay from "@/components/layout/AddressDisplay";
import Link from "next/link";

const NFT_ABI = [
  ...AIRitualNFT_ABI,
  { inputs: [], name: "name", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "baseURI", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "owner", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

const OWNER_OF_ABI = [{
  inputs: [{ name: "tokenId", type: "uint256" }],
  name: "ownerOf",
  outputs: [{ name: "", type: "address" }],
  stateMutability: "view",
  type: "function",
}] as const;

export default function CollectionPage() {
  const params = useParams();
  const address = params.address as `0x${string}`;
  const [localMeta, setLocalMeta] = useState<{ image?: string; name?: string; description?: string } | null>(null);
  const [filter, setFilter] = useState<"all" | "listed">("all");
  const [coverImage, setCoverImage] = useState<string>("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`cauldron_meta_${address?.toLowerCase()}`);
      if (saved) setLocalMeta(JSON.parse(saved));
    } catch {}
  }, [address]);

  // Core collection info
  const { data: onChainName } = useReadContract({ address, abi: NFT_ABI, functionName: "name" });
  const { data: symbol } = useReadContract({ address, abi: NFT_ABI, functionName: "symbol" });
  const { data: totalSupplyRaw } = useReadContract({ address, abi: NFT_ABI, functionName: "totalSupply" });
  const { data: maxSupply } = useReadContract({ address, abi: NFT_ABI, functionName: "maxSupply" });
  const { data: onChainBaseURI } = useReadContract({ address, abi: NFT_ABI, functionName: "baseURI" });
  const { data: totalPhases } = useReadContract({ address, abi: AIRitualNFT_ABI, functionName: "totalPhases" });

  // Race 4 IPFS gateways: try baseURI+"0" (cover), fallback to baseURI+"1"
  // For single-image collections, baseURI is the image CID itself
  useEffect(() => {
    async function fetchCover() {
      const base = onChainBaseURI as string;
      if (!base) return;
      // Single-image: baseURI is the image CID (no trailing slash)
      if (!base.endsWith("/")) {
        setCoverImage(resolveIPFSGateway(base));
        return;
      }
      const cover = await raceIPFSFetchJSON(base + "0");
      if (cover?.image) { setCoverImage(resolveIPFSGateway(cover.image)); return; }
      const token1 = await raceIPFSFetchJSON(base + "1");
      if (token1?.image) { setCoverImage(resolveIPFSGateway(token1.image)); }
    }
    fetchCover();
  }, [onChainBaseURI]);

  const name = onChainName?.toString() || localMeta?.name || shortenAddress(address ?? "");
  const totalSupply = Number(totalSupplyRaw ?? 0n);
  const supply = Number(maxSupply ?? 0n);
  const imageUrl = coverImage || "";
  const progress = supply > 0 ? Math.min((totalSupply / supply) * 100, 100) : 0;

  // Build token list 1..totalSupply
  const tokenIds = Array.from({ length: totalSupply }, (_, i) => BigInt(i + 1));

  // Batch: ownerOf + getListing for each token
  const ownerCalls = tokenIds.map(tid => ({
    address, abi: OWNER_OF_ABI, functionName: "ownerOf", args: [tid],
  }));
  const listingCalls = tokenIds.map(tid => ({
    address: MARKETPLACE_ADDRESS, abi: RitualMarketplace_ABI, functionName: "getListing", args: [address, tid],
  }));

  const { data: ownerData } = useReadContracts({ contracts: ownerCalls as any[], query: { enabled: tokenIds.length > 0 } });
  const { data: listingData } = useReadContracts({ contracts: listingCalls as any[], query: { enabled: tokenIds.length > 0 } });

  // Build NFT list
  const nfts = tokenIds.map((tid, i) => {
    const owner = ownerData?.[i]?.result as string ?? "";
    const listing = listingData?.[i]?.result as any;
    const isListed = listing?.active === true;
    return { tokenId: Number(tid), owner, listing, isListed };
  });

  const displayed = filter === "listed" ? nfts.filter(n => n.isListed) : nfts;
  const listedCount = nfts.filter(n => n.isListed).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 animate-fade-in">
      {/* Header */}
      <div className="glass-card p-8 mb-8">
        <div className="flex gap-8 items-start">
          {/* Collection image */}
          <div className="w-28 h-28 rounded-2xl overflow-hidden flex-shrink-0"
            style={{ background: "rgba(200,247,197,0.06)", border: "1px solid rgba(200,247,197,0.1)" }}>
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-display font-black text-3xl"
                style={{ color: "rgba(200,247,197,0.15)" }}>
                {symbol?.toString()?.slice(0, 2) || "??"}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-black text-4xl" style={{ color: "var(--mint)" }}>{name}</h1>
            <p className="text-xs font-mono mt-1" style={{ color: "rgba(200,247,197,0.2)" }}>{address}</p>
            {localMeta?.description && (
              <p className="text-sm mt-3" style={{ color: "rgba(200,247,197,0.4)" }}>{localMeta.description}</p>
            )}

            {/* Stats row */}
            <div className="flex gap-6 mt-5">
              {[
                { label: "MINTED", value: totalSupply },
                { label: "SUPPLY", value: supply },
                { label: "LISTED", value: listedCount },
                { label: "PHASES", value: Number(totalPhases ?? 0n) },
              ].map(s => (
                <div key={s.label}>
                  <div className="font-display font-black text-2xl" style={{ color: "var(--mint)" }}>{s.value}</div>
                  <div className="text-[10px] font-bold tracking-widest" style={{ color: "rgba(200,247,197,0.25)" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="mt-5 space-y-1.5">
              <div className="h-1.5 rounded-full" style={{ background: "rgba(200,247,197,0.06)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${progress}%`, background: "var(--mint)", boxShadow: "0 0 10px rgba(200,247,197,0.3)" }} />
              </div>
            </div>
          </div>

          {/* Mint button or Sold Out */}
          {supply > 0 && totalSupply >= supply ? (
            <div className="px-6 py-3 rounded-2xl text-xs font-black tracking-wider flex-shrink-0"
              style={{ background: "rgba(200,247,197,0.06)", color: "rgba(200,247,197,0.3)" }}>
              SOLD OUT
            </div>
          ) : (
            <Link href={`/mint/${address}`} className="btn-primary px-6 py-3 text-xs font-black flex-shrink-0">
              MINT NOW
            </Link>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-3 mb-6">
        {(["all", "listed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-5 py-2 rounded-xl text-xs font-bold tracking-wider transition-all"
            style={{
              background: filter === f ? "rgba(200,247,197,0.08)" : "transparent",
              color: filter === f ? "var(--mint)" : "rgba(200,247,197,0.2)",
              border: `1px solid ${filter === f ? "rgba(200,247,197,0.15)" : "transparent"}`,
            }}>
            {f === "all" ? `ALL ${totalSupply}` : `LISTED ${listedCount}`}
          </button>
        ))}
      </div>

      {/* NFT Grid */}
      {totalSupply === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="font-display font-black text-4xl" style={{ color: "rgba(200,247,197,0.06)" }}>0</div>
          <p style={{ color: "rgba(200,247,197,0.2)" }}>No NFTs minted yet</p>
          <Link href={`/mint/${address}`} className="btn-primary px-8 py-3 text-sm font-black">MINT FIRST</Link>
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p style={{ color: "rgba(200,247,197,0.2)" }}>No listed NFTs</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {displayed.map(nft => (
            <NFTGridItem
              key={nft.tokenId}
              address={address}
              nft={nft}
              collectionName={name}
              fallbackImageUrl={imageUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NFTGridItem({ address, nft, collectionName, fallbackImageUrl }: any) {
  const [tokenMeta, setTokenMeta] = useState<{ image?: string; name?: string } | null>(null);

  const TOKEN_URI_ABI = [{ inputs: [{ name: "tokenId", type: "uint256" }], name: "tokenURI", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" }] as const;
  const { data: tokenURIData } = useReadContract({ address, abi: TOKEN_URI_ABI, functionName: "tokenURI", args: [BigInt(nft.tokenId)] });

  useEffect(() => {
    const uri = tokenURIData as string;
    if (!uri) return;
    const gateway = resolveIPFSGateway(uri);
    if (!gateway) return;
    fetch(gateway)
      .then(res => res.ok ? res.json() : null)
      .then(json => { if (json) setTokenMeta(json); })
      .catch(() => {
        // Not JSON — could be a direct image URL for single-image collections
        // Use the gateway URL as the image directly
        setTokenMeta({ image: uri });
      });
  }, [tokenURIData]);

  const rawImage = tokenMeta?.image || "";
  const uniqueImageUrl = rawImage ? resolveIPFSGateway(rawImage) : "";
  const displayImage = uniqueImageUrl || fallbackImageUrl;
  const displayName = tokenMeta?.name || `${collectionName} #${nft.tokenId}`;

  return (
    <Link href={`/collection/${address}/${nft.tokenId}`}
      className="glass-card group overflow-hidden block cursor-pointer transition-all hover:scale-[1.02]"
      style={{ textDecoration: "none" }}>
      {/* Image */}
      <div className="relative aspect-square overflow-hidden" style={{ background: "rgba(200,247,197,0.04)" }}>
        {displayImage ? (
          <img src={displayImage} alt={displayName}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-display font-black text-3xl"
            style={{ color: "rgba(200,247,197,0.08)" }}>
            #{nft.tokenId}
          </div>
        )}
        {/* Listed badge */}
        {nft.isListed && (
          <div className="absolute top-3 left-3 px-2 py-1 rounded-lg text-[10px] font-black tracking-wider"
            style={{ background: "rgba(200,247,197,0.15)", color: "var(--mint)", backdropFilter: "blur(8px)" }}>
            FOR SALE
          </div>
        )}
        {/* Price */}
        {nft.isListed && (
          <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-xl backdrop-blur-md"
            style={{ background: "rgba(4,15,10,0.85)", border: "1px solid rgba(200,247,197,0.15)" }}>
            <span className="text-sm font-bold" style={{ color: "var(--mint)" }}>
              {formatEther(BigInt(nft.listing?.price ?? 0))} RITUAL
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-bold text-sm" style={{ color: "var(--mint)" }}>{displayName}</div>
        </div>
        <div className="text-[10px] font-mono" style={{ color: "rgba(200,247,197,0.2)" }}>
          {nft.owner ? <AddressDisplay address={nft.owner} /> : "..."}
        </div>
      </div>
    </Link>
  );
}
