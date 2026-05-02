"use client";

import { useParams } from "next/navigation";
import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { useState, useEffect } from "react";
import { formatEther } from "viem";
import { MARKETPLACE_ADDRESS, RitualMarketplace_ABI, AIRitualNFT_ABI } from "@/lib/contracts";
import { resolveIPFSGateway } from "@/lib/pinata";
import { shortenAddress } from "@/lib/api";
import Link from "next/link";

const NFT_ABI = [
  ...AIRitualNFT_ABI,
  { inputs: [], name: "name", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "baseURI", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
] as const;

const OWNER_ABI = [{
  inputs: [{ name: "tokenId", type: "uint256" }],
  name: "ownerOf",
  outputs: [{ name: "", type: "address" }],
  stateMutability: "view",
  type: "function",
}] as const;

export default function ItemPage() {
  const params = useParams();
  const contractAddress = params.address as `0x${string}`;
  const tokenId = BigInt(params.tokenId as string);
  const { address: connectedWallet } = useAccount();
  const [localMeta, setLocalMeta] = useState<{ image?: string; name?: string; description?: string; imageMode?: string } | null>(null);
  const [tokenMeta, setTokenMeta] = useState<{ name?: string; description?: string; image?: string } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`cauldron_meta_${contractAddress?.toLowerCase()}`);
      if (saved) setLocalMeta(JSON.parse(saved));
    } catch {}
  }, [contractAddress]);

  // Collection info
  const { data: colName } = useReadContract({ address: contractAddress, abi: NFT_ABI, functionName: "name" });
  const { data: symbol } = useReadContract({ address: contractAddress, abi: NFT_ABI, functionName: "symbol" });
  const { data: totalSupply } = useReadContract({ address: contractAddress, abi: NFT_ABI, functionName: "totalSupply" });
  const { data: maxSupply } = useReadContract({ address: contractAddress, abi: NFT_ABI, functionName: "maxSupply" });
  const { data: onChainBaseURI } = useReadContract({ address: contractAddress, abi: NFT_ABI, functionName: "baseURI" });

  // Read tokenURI for this specific token (multi-image support)
  const TOKEN_URI_ABI = [{ inputs: [{ name: "tokenId", type: "uint256" }], name: "tokenURI", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" }] as const;
  const { data: tokenURIData } = useReadContract({ address: contractAddress, abi: TOKEN_URI_ABI, functionName: "tokenURI", args: [tokenId] });

  // Fetch individual token metadata JSON from IPFS if tokenURI exists
  useEffect(() => {
    const uri = tokenURIData as string;
    if (!uri) return;
    const gateway = resolveIPFSGateway(uri);
    if (!gateway) return;
    fetch(gateway)
      .then(res => res.ok ? res.json() : null)
      .then(json => { if (json) setTokenMeta(json); })
      .catch(() => {});
  }, [tokenURIData]);

  // Token info
  const { data: owner, refetch: refetchOwner } = useReadContract({ address: contractAddress, abi: OWNER_ABI, functionName: "ownerOf", args: [tokenId] });
  const { data: listing, refetch: refetchListing } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: RitualMarketplace_ABI,
    functionName: "getListing",
    args: [contractAddress, tokenId],
  });

  // Approval check for listing
  const { data: isApproved } = useReadContract({
    address: contractAddress,
    abi: [{ inputs: [{ name: "owner", type: "address" }, { name: "operator", type: "address" }], name: "isApprovedForAll", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" }] as const,
    functionName: "isApprovedForAll",
    args: [connectedWallet as `0x${string}`, MARKETPLACE_ADDRESS],
    query: { enabled: !!connectedWallet },
  });

  // Use individual token metadata if available, otherwise fall back to collection-level
  const collectionName = colName?.toString() || localMeta?.name || shortenAddress(contractAddress);
  const nftName = tokenMeta?.name || `${collectionName} #${tokenId.toString()}`;
  const nftDescription = tokenMeta?.description || localMeta?.description || "";
  const rawImage = tokenMeta?.image || localMeta?.image || (onChainBaseURI as string) || "";
  const imageUrl = rawImage ? resolveIPFSGateway(rawImage) : "";
  const ownerAddress = owner as string ?? "";
  const isOwner = ownerAddress?.toLowerCase() === connectedWallet?.toLowerCase();
  const listingData = listing as any;
  const isListed = listingData?.active === true;
  const minted = Number(totalSupply ?? 0n);
  const supply = Number(maxSupply ?? 0n);
  const isSoldOut = supply > 0 && minted >= supply;

  // Buy flow
  const { writeContract: buyWrite, data: buyTx, isPending: buyPending } = useWriteContract();
  const { isLoading: buyConfirming, isSuccess: buySuccess } = useWaitForTransactionReceipt({ hash: buyTx });

  // Approve flow
  const { writeContract: approveWrite, data: approveTx, isPending: approvePending } = useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTx });

  // List flow
  const [listPrice, setListPrice] = useState("");
  const { writeContract: listWrite, data: listTx, isPending: listPending } = useWriteContract();
  const { isLoading: listConfirming, isSuccess: listSuccess } = useWaitForTransactionReceipt({ hash: listTx });

  // Cancel flow
  const { writeContract: cancelWrite, data: cancelTx, isPending: cancelPending } = useWriteContract();
  const { isLoading: cancelConfirming, isSuccess: cancelSuccess } = useWaitForTransactionReceipt({ hash: cancelTx });

  useEffect(() => { if (buySuccess || listSuccess || cancelSuccess || approveSuccess) { refetchOwner(); refetchListing(); } },
    [buySuccess, listSuccess, cancelSuccess, approveSuccess]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-mono mb-8" style={{ color: "rgba(200,247,197,0.3)" }}>
        <Link href="/collections" className="hover:underline" style={{ color: "rgba(200,247,197,0.4)" }}>Collections</Link>
        <span>→</span>
        <Link href={`/collection/${contractAddress}`} className="hover:underline" style={{ color: "rgba(200,247,197,0.4)" }}>{collectionName}</Link>
        <span>→</span>
        <span style={{ color: "var(--mint)" }}>#{tokenId.toString()}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-10 items-start">
        {/* Left — Image */}
        <div>
          <div className="rounded-3xl overflow-hidden aspect-square"
            style={{ background: "rgba(200,247,197,0.04)", border: "1px solid rgba(200,247,197,0.08)" }}>
            {imageUrl ? (
              <img src={imageUrl} alt={nftName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <div className="font-display font-black text-6xl" style={{ color: "rgba(200,247,197,0.08)" }}>
                  {symbol?.toString()?.slice(0, 2) ?? "??"}
                </div>
                <p className="text-[10px]" style={{ color: "rgba(200,247,197,0.15)" }}>No image</p>
              </div>
            )}
          </div>

          {/* Description */}
          {nftDescription && (
            <div className="glass-card p-5 mt-5">
              <div className="text-[10px] font-black tracking-widest mb-2" style={{ color: "rgba(200,247,197,0.25)" }}>DESCRIPTION</div>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(200,247,197,0.5)" }}>{nftDescription}</p>
            </div>
          )}
        </div>

        {/* Right — Details */}
        <div className="space-y-6">
          {/* Name and collection */}
          <div>
            <Link href={`/collection/${contractAddress}`}>
              <div className="text-xs font-mono tracking-widest mb-2 hover:underline" style={{ color: "rgba(200,247,197,0.3)" }}>
                {collectionName} · {symbol?.toString()}
              </div>
            </Link>
            <h1 className="font-display font-black text-4xl" style={{ color: "var(--mint)" }}>{nftName}</h1>
          </div>

          {/* Owner */}
          <div className="glass-card p-5">
            <div className="text-[10px] font-black tracking-widest mb-2" style={{ color: "rgba(200,247,197,0.25)" }}>OWNER</div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs"
                style={{ background: "var(--mint)", color: "#040f0a" }}>
                {ownerAddress?.slice(2, 4)?.toUpperCase() || "??"}
              </div>
              <div>
                <div className="font-mono text-sm font-bold" style={{ color: "var(--mint)" }}>
                  {ownerAddress ? shortenAddress(ownerAddress) : "Loading..."}
                </div>
                {isOwner && <div className="text-[10px] font-bold" style={{ color: "rgba(200,247,197,0.3)" }}>YOU</div>}
              </div>
            </div>
          </div>

          {/* Price / Buy / List */}
          {isListed ? (
            <div className="glass-card p-6 space-y-4" style={{ border: "1px solid rgba(200,247,197,0.15)" }}>
              <div className="text-[10px] font-black tracking-widest" style={{ color: "rgba(200,247,197,0.25)" }}>LISTED FOR SALE</div>
              <div className="font-display font-black text-4xl" style={{ color: "var(--mint)" }}>
                {formatEther(BigInt(listingData.price))} RITUAL
              </div>
              {isOwner ? (
                <button onClick={() => cancelWrite({ address: MARKETPLACE_ADDRESS, abi: RitualMarketplace_ABI, functionName: "cancelListing", args: [contractAddress, tokenId] })}
                  className="w-full py-3 rounded-xl text-xs font-black tracking-wider"
                  style={{ background: "rgba(255,120,120,0.1)", color: "rgba(255,120,120,0.8)", border: "1px solid rgba(255,120,120,0.15)" }}
                  disabled={cancelPending || cancelConfirming}>
                  {cancelPending || cancelConfirming ? "CANCELLING..." : "CANCEL LISTING"}
                </button>
              ) : (
                <button onClick={() => buyWrite({ address: MARKETPLACE_ADDRESS, abi: RitualMarketplace_ABI, functionName: "buy", args: [contractAddress, tokenId], value: BigInt(listingData.price) })}
                  className="btn-primary w-full py-3.5 text-sm font-black"
                  disabled={buyPending || buyConfirming}>
                  {buyPending || buyConfirming ? "BUYING..." : "BUY NOW"}
                </button>
              )}
            </div>
          ) : isOwner ? (
            <div className="glass-card p-6 space-y-4">
              <div className="text-[10px] font-black tracking-widest" style={{ color: "rgba(200,247,197,0.25)" }}>LIST FOR SALE</div>
              {isApproved ? (
                <>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      step="0.001"
                      placeholder="Price in RITUAL"
                      value={listPrice}
                      onChange={e => setListPrice(e.target.value)}
                      className="flex-1 px-4 py-3 rounded-xl text-sm font-mono"
                      style={{ background: "rgba(200,247,197,0.04)", border: "1px solid rgba(200,247,197,0.1)", color: "var(--mint)", outline: "none" }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!listPrice || parseFloat(listPrice) <= 0) return;
                      const priceWei = BigInt(Math.floor(parseFloat(listPrice) * 1e18));
                      listWrite({ address: MARKETPLACE_ADDRESS, abi: RitualMarketplace_ABI, functionName: "list", args: [contractAddress, tokenId, priceWei] });
                    }}
                    className="btn-primary w-full py-3 text-xs font-black"
                    disabled={listPending || listConfirming || !listPrice}>
                    {listPending || listConfirming ? "LISTING..." : "LIST NOW"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => approveWrite({
                    address: contractAddress,
                    abi: [{ inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], name: "setApprovalForAll", outputs: [], stateMutability: "nonpayable", type: "function" }] as const,
                    functionName: "setApprovalForAll",
                    args: [MARKETPLACE_ADDRESS, true],
                  })}
                  className="btn-primary w-full py-3 text-xs font-black"
                  disabled={approvePending || approveConfirming}>
                  {approvePending || approveConfirming ? "APPROVING..." : "APPROVE MARKETPLACE"}
                </button>
              )}
            </div>
          ) : (
            <div className="glass-card p-5">
              <div className="text-sm" style={{ color: "rgba(200,247,197,0.3)" }}>Not listed for sale</div>
            </div>
          )}

          {/* Collection info */}
          <div className="glass-card p-5 space-y-3">
            <div className="text-[10px] font-black tracking-widest" style={{ color: "rgba(200,247,197,0.25)" }}>COLLECTION INFO</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Contract", value: shortenAddress(contractAddress) },
                { label: "Token ID", value: `#${tokenId.toString()}` },
                { label: "Supply", value: `${minted} / ${supply}` },
                { label: "Status", value: isSoldOut ? "Sold Out" : "Minting" },
              ].map(r => (
                <div key={r.label} className="flex justify-between py-2 px-3 rounded-xl" style={{ background: "rgba(200,247,197,0.03)" }}>
                  <span className="text-[10px] font-bold" style={{ color: "rgba(200,247,197,0.25)" }}>{r.label}</span>
                  <span className="text-xs font-bold font-mono" style={{ color: "rgba(200,247,197,0.5)" }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mint button if not sold out and not owner */}
          {!isSoldOut && !isOwner && !isListed && (
            <Link href={`/mint/${contractAddress}`} className="btn-primary block text-center py-3 text-xs font-black">
              MINT FROM THIS COLLECTION
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
