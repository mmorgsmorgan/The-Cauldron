"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContracts } from "wagmi";
import { formatEther } from "viem";
import { MARKETPLACE_ADDRESS, RitualMarketplace_ABI, FACTORY_ADDRESS, NFTFactory_ABI, AIRitualNFT_ABI } from "@/lib/contracts";
import { resolveIPFSGateway, raceIPFSFetchJSON } from "@/lib/pinata";
import { shortenAddress } from "@/lib/api";
import { useListings } from "@/hooks/useData";
import Link from "next/link";

const NFT_ABI_BASIC = [
  ...AIRitualNFT_ABI,
  { inputs: [], name: "name", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "baseURI", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
] as const;

interface ListingEntry {
  contract: string;
  token_id: string;
  seller: string;
  price: string;
  collection_name: string | null;
  is_verified: boolean;
  metadata: any;
  metadata_status: string;
}

function ListingCard({ listing, baseURI }: { listing: ListingEntry; baseURI: string }) {
  const { address } = useAccount();
  const [coverImage, setCoverImage] = useState(listing.metadata?.image ? resolveIPFSGateway(listing.metadata.image) : "");
  const [bought, setBought] = useState(false);

  const { writeContract, data: buyTx, isPending } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: buyTx });

  // Fetch image from IPFS if not already in metadata (multi-image collections)
  useEffect(() => {
    if (coverImage || !baseURI) return;
    const isMulti = baseURI.endsWith("/");
    const uri = isMulti ? baseURI + listing.token_id : baseURI;
    raceIPFSFetchJSON(uri).then((json) => {
      if (json?.image) setCoverImage(resolveIPFSGateway(json.image));
    });
  }, [baseURI, listing.token_id, coverImage]);

  useEffect(() => { if (isSuccess) setBought(true); }, [isSuccess]);

  function handleBuy() {
    if (!address) return;
    writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: RitualMarketplace_ABI,
      functionName: "buy",
      args: [listing.contract as `0x${string}`, BigInt(listing.token_id)],
      value: BigInt(listing.price),
      gas: 300000n,
    });
  }

  const isSelf = address?.toLowerCase() === listing.seller.toLowerCase();
  const priceEth = formatEther(BigInt(listing.price));

  return (
    <div className="glass-card overflow-hidden group transition-all hover:scale-[1.02] hover:shadow-2xl" id={`listing-${listing.contract}-${listing.token_id}`}>
      {/* Image */}
      <Link href={`/collection/${listing.contract}`}>
        <div className="relative aspect-square overflow-hidden rounded-t-3xl" style={{ background: "#061a10" }}>
          {coverImage ? (
            <img src={coverImage} alt={listing.collection_name || "NFT"}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
          ) : (
            <div className="w-full h-full flex items-center justify-center shimmer-bg">
              <div className="w-8 h-8 rounded-full animate-spin"
                style={{ border: "2px solid rgba(200,247,197,0.1)", borderTopColor: "rgba(200,247,197,0.5)" }} />
            </div>
          )}

          {/* Price badge */}
          <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl backdrop-blur-md"
            style={{ background: "rgba(4,15,10,0.85)", border: "1px solid rgba(200,247,197,0.2)" }}>
            <span className="text-sm font-black" style={{ color: "var(--mint)" }}>{priceEth} RITUAL</span>
          </div>

          {/* Token ID badge */}
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-black"
            style={{ background: "rgba(4,15,10,0.75)", color: "rgba(200,247,197,0.5)", backdropFilter: "blur(8px)" }}>
            #{listing.token_id}
          </div>

          {/* Verified badge */}
          {listing.is_verified && (
            <div className="absolute top-3 right-3">
              <span className="badge-verified flex items-center gap-1">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Verified
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="p-4 space-y-3">
        <div className="min-w-0">
          <Link href={`/collection/${listing.contract}`}>
            <h3 className="font-bold text-sm truncate hover:underline" style={{ color: "var(--mint)" }}>
              {listing.collection_name || listing.metadata?.name || shortenAddress(listing.contract)}
            </h3>
          </Link>
          <p className="text-xs font-mono mt-0.5 truncate" style={{ color: "rgba(200,247,197,0.2)" }}>
            by {shortenAddress(listing.seller)}
          </p>
        </div>

        {bought ? (
          <div className="w-full py-2.5 rounded-xl text-center text-xs font-black tracking-wider"
            style={{ background: "rgba(200,247,197,0.08)", color: "var(--mint)", border: "1px solid rgba(200,247,197,0.2)" }}>
            ✓ PURCHASED!
          </div>
        ) : isSelf ? (
          <div className="w-full py-2.5 rounded-xl text-center text-xs font-bold"
            style={{ background: "rgba(200,247,197,0.04)", color: "rgba(200,247,197,0.3)", border: "1px solid rgba(200,247,197,0.08)" }}>
            YOUR LISTING
          </div>
        ) : !address ? (
          <div className="w-full py-2.5 rounded-xl text-center text-xs font-bold"
            style={{ background: "rgba(200,247,197,0.04)", color: "rgba(200,247,197,0.3)" }}>
            CONNECT TO BUY
          </div>
        ) : (
          <button
            id={`buy-btn-${listing.contract}-${listing.token_id}`}
            onClick={handleBuy}
            disabled={isPending || confirming}
            className="w-full btn-primary text-xs py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "CONFIRM IN WALLET..." : confirming ? "CONFIRMING TX..." : `BUY · ${priceEth} RITUAL`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const { data, isLoading, refetch } = useListings(100, 0);
  const activeListings: ListingEntry[] = (data?.listings || []).filter((l: any) => l.active !== false);

  // Read baseURIs for all unique contracts in listings
  const uniqueContracts = [...new Set(activeListings.map(l => l.contract))] as `0x${string}`[];
  const baseURICalls = uniqueContracts.map(addr => ({
    address: addr, abi: NFT_ABI_BASIC, functionName: "baseURI",
  }));
  const { data: baseURIData } = useReadContracts({
    contracts: baseURICalls as any[],
    query: { enabled: uniqueContracts.length > 0 },
  });
  const baseURIMap = new Map<string, string>();
  uniqueContracts.forEach((addr, i) => {
    baseURIMap.set(addr.toLowerCase(), baseURIData?.[i]?.result as string ?? "");
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="font-display font-black text-5xl tracking-tight" style={{ color: "var(--mint)" }}>EXPLORE</h1>
          <p className="mt-2 text-sm" style={{ color: "rgba(200,247,197,0.3)" }}>
            Browse &amp; buy NFTs listed on The Cauldron Marketplace
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetch()}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={{ background: "rgba(200,247,197,0.06)", color: "rgba(200,247,197,0.4)", border: "1px solid rgba(200,247,197,0.1)" }}>
            ↻ REFRESH
          </button>
          <div className="px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: "rgba(200,247,197,0.06)", color: "rgba(200,247,197,0.4)" }}>
            {activeListings.length} LISTINGS
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="glass-card animate-pulse">
              <div className="aspect-square rounded-t-3xl" style={{ background: "rgba(200,247,197,0.04)" }} />
              <div className="p-4 space-y-2">
                <div className="h-4 rounded w-3/4" style={{ background: "rgba(200,247,197,0.05)" }} />
                <div className="h-8 rounded-xl" style={{ background: "rgba(200,247,197,0.04)" }} />
              </div>
            </div>
          ))}
        </div>
      ) : activeListings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="font-display font-black text-5xl" style={{ color: "rgba(200,247,197,0.06)" }}>--</div>
          <p className="font-bold" style={{ color: "rgba(200,247,197,0.2)" }}>No active listings yet</p>
          <p className="text-xs text-center" style={{ color: "rgba(200,247,197,0.1)" }}>
            Own an NFT? List it from your Profile page
          </p>
          <Link href="/profile" className="btn-primary px-6 py-3 text-xs font-black mt-2">
            GO TO PROFILE
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {activeListings.map((listing) => (
            <ListingCard
              key={`${listing.contract}-${listing.token_id}`}
              listing={listing}
              baseURI={baseURIMap.get(listing.contract.toLowerCase()) ?? ""}
            />
          ))}
        </div>
      )}
    </div>
  );
}
