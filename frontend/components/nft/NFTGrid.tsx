"use client";

import { NFTItem } from "@/lib/api";
import NFTCard from "./NFTCard";

interface NFTGridProps {
  nfts: NFTItem[];
  loading?: boolean;
  emptyMessage?: string;
  showPrice?: (nft: NFTItem) => string | undefined;
  onAction?: (nft: NFTItem) => void;
  actionLabel?: string;
}

export default function NFTGrid({
  nfts,
  loading,
  emptyMessage = "No NFTs found",
  showPrice,
  onAction,
  actionLabel,
}: NFTGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center font-display font-black text-2xl"
          style={{ background: "rgba(200,247,197,0.05)", color: "rgba(200,247,197,0.15)" }}>
          --
        </div>
        <p className="text-lg font-semibold" style={{ color: "rgba(200,247,197,0.25)" }}>
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
      {nfts.map((nft) => (
        <NFTCard
          key={`${nft.contract}-${nft.tokenId}`}
          nft={nft}
          showPrice={showPrice?.(nft)}
          onAction={onAction ? () => onAction(nft) : undefined}
          actionLabel={actionLabel}
        />
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="glass-card">
      <div className="aspect-square rounded-t-3xl shimmer-bg" style={{ background: "#061a10" }} />
      <div className="p-4 space-y-3">
        <div className="h-4 rounded-full w-3/4" style={{ background: "rgba(200,247,197,0.06)" }} />
        <div className="h-3 rounded-full w-1/2" style={{ background: "rgba(200,247,197,0.04)" }} />
      </div>
    </div>
  );
}
