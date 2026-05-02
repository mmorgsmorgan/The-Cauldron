"use client";

import { NFTItem, resolveIPFS, shortenAddress } from "@/lib/api";
import { resolveIPFSGateway, raceIPFSFetchJSON } from "@/lib/pinata";
import { useState, useEffect } from "react";
import Link from "next/link";

interface NFTCardProps {
  nft: NFTItem;
  showPrice?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export default function NFTCard({ nft, showPrice, onAction, actionLabel }: NFTCardProps) {
  const [imgError, setImgError] = useState(false);
  const [resolvedImage, setResolvedImage] = useState("");
  const [metaStatus, setMetaStatus] = useState(nft.metadataStatus);

  // For multi-image collections: fetch per-token metadata from IPFS (races 4 gateways)
  useEffect(() => {
    const baseURI = (nft as any).baseURI;
    if (!baseURI || nft.image) return;

    async function fetchTokenMeta() {
      const json = await raceIPFSFetchJSON(baseURI + nft.tokenId);
      if (json?.image) {
        setResolvedImage(resolveIPFSGateway(json.image));
        setMetaStatus("full");
      } else {
        setMetaStatus("broken");
      }
    }
    fetchTokenMeta();
  }, [(nft as any).baseURI, nft.tokenId, nft.image]);

  const imageUrl = nft.image ? resolveIPFS(nft.image) : resolvedImage;

  return (
    <div className="glass-card group cursor-pointer" id={`nft-${nft.contract}-${nft.tokenId}`}>
      {/* Image area — clicks go to collection page */}
      <Link href={`/collection/${nft.contract}`}>
        <div className="relative aspect-square overflow-hidden rounded-t-3xl" style={{ background: "#061a10" }}>
          {metaStatus === "full" && imageUrl && !imgError ? (
            <img
              src={imageUrl}
              alt={nft.name || "NFT"}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              onError={() => setImgError(true)}
            />
          ) : metaStatus === "broken" || imgError ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3"
              style={{ background: "linear-gradient(135deg, #061a10, #0a2e1f)" }}>
              <div className="text-2xl font-black opacity-20" style={{ color: "var(--mint)" }}>!</div>
              <span className="text-xs font-bold tracking-wider uppercase" style={{ color: "rgba(200,247,197,0.2)" }}>
                Metadata Unavailable
              </span>
            </div>
          ) : metaStatus === "unrevealed" ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3"
              style={{ background: "linear-gradient(135deg, #0a2e1f, #134d34)" }}>
              <div className="text-2xl font-black opacity-20 animate-float" style={{ color: "var(--mint)" }}>?</div>
              <span className="text-xs font-bold tracking-wider uppercase" style={{ color: "rgba(200,247,197,0.35)" }}>
                Unrevealed
              </span>
            </div>
          ) : (
            <div className="w-full h-full shimmer-bg flex items-center justify-center">
              <div className="w-8 h-8 rounded-full animate-spin"
                style={{ border: "2px solid rgba(200,247,197,0.1)", borderTopColor: "rgba(200,247,197,0.5)" }} />
            </div>
          )}

          {/* Verified badge */}
          {nft.isVerified && (
            <div className="absolute top-3 left-3">
              <span className="badge-verified flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Verified
              </span>
            </div>
          )}

          {/* Price tag */}
          {showPrice && (
            <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl backdrop-blur-md"
              style={{ background: "rgba(4,15,10,0.8)", border: "1px solid rgba(200,247,197,0.15)" }}>
              <span className="text-sm font-bold" style={{ color: "var(--mint)" }}>{showPrice} RITUAL</span>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {/* Name links to collection page */}
            <Link href={`/collection/${nft.contract}`}>
              <h3 className="font-bold truncate text-sm hover:underline" style={{ color: "var(--mint)" }}>
                {nft.name || `#${nft.tokenId}`}
              </h3>
            </Link>
            <p className="text-xs truncate mt-0.5" style={{ color: "rgba(200,247,197,0.3)" }}>
              {nft.collectionName || shortenAddress(nft.contract)}
            </p>
          </div>
          <span className="text-xs shrink-0 font-mono" style={{ color: "rgba(200,247,197,0.15)" }}>
            #{nft.tokenId}
          </span>
        </div>

        {(metaStatus === "broken" || metaStatus === "unrevealed") && (
          <div className="pt-2 mt-1" style={{ borderTop: "1px solid rgba(200,247,197,0.05)" }}>
            <code className="text-[10px] break-all font-mono" style={{ color: "rgba(200,247,197,0.15)" }}>
              {nft.contract}
            </code>
          </div>
        )}

        {onAction && actionLabel && (
          <button onClick={(e) => { e.stopPropagation(); onAction(); }} className="w-full btn-primary text-xs py-2.5 mt-2">
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

