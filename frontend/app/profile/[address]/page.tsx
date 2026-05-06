"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { NFTItem, generateMerkleRoot } from "@/lib/api";
import { shortenAddress } from "@/lib/names";
import AddressDisplay from "@/components/layout/AddressDisplay";
import { useRitualName } from "@/hooks/useRitualName";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, zeroHash, formatEther } from "viem";
import { FACTORY_ADDRESS, NFTFactory_ABI, MARKETPLACE_ADDRESS, RitualMarketplace_ABI, AIRitualNFT_ABI } from "@/lib/contracts";
import NFTGrid from "@/components/nft/NFTGrid";
import DeployWizard from "@/components/deploy/DeployWizard";
import { useNFTOwnership } from "@/hooks/useNFTOwnership";

// ABI used in AuctionTab for tokensOfOwner
const NFT_ABI_EXT = [
  ...AIRitualNFT_ABI,
  { inputs: [{ name: "owner", type: "address" }], name: "tokensOfOwner", outputs: [{ name: "", type: "uint256[]" }], stateMutability: "view", type: "function" },
] as const;

type TabKey = "nfts" | "deploy" | "auction";

export default function ProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const address = params.address as string;
  const { address: connectedAddress } = useAccount();
  const isOwn = connectedAddress?.toLowerCase() === address?.toLowerCase();
  const initialTab = (searchParams.get("tab") as TabKey) || "nfts";
  const [tab, setTab] = useState<TabKey>(initialTab);
  const { display: nameDisplay, name } = useRitualName(address);

  // Use cached ownership hook — single multicall, React Query 60s cache
  const { ownedNFTs: rawOwned, isLoading } = useNFTOwnership(address);

  // Map OwnedNFTEntry → NFTItem shape for NFTGrid/NFTCard
  const ownedNFTs: NFTItem[] = rawOwned.map((entry) => ({
    tokenId: entry.tokenId,
    name: entry.name,
    image: entry.isMultiImage ? null : (entry.baseURI || null),
    contract: entry.contract,
    isVerified: true,
    collectionName: entry.collectionName,
    metadataStatus: entry.isMultiImage ? "loading" : "full",
    collection: { name: entry.collectionName, symbol: entry.symbol, totalSupply: 1 },
    baseURI: entry.isMultiImage ? entry.baseURI : "",
  } as any));

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 animate-fade-in">
      {/* Header */}
      <div className="glass-card p-8 mb-8">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-black text-2xl"
            style={{ background: "var(--mint)", color: "#040f0a" }}>
            {address?.slice(2, 4).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="font-display font-black text-3xl" style={{ color: "var(--mint)" }}>
              {isOwn ? (name ? name : "MY PROFILE") : nameDisplay}
            </h1>
            <p className="text-xs font-mono mt-1" style={{ color: "rgba(200,247,197,0.2)" }}>{address}</p>
          </div>
          <div className="text-center p-4 rounded-2xl" style={{ background: "rgba(200,247,197,0.04)" }}>
            <div className="font-display font-black text-2xl gradient-text">{ownedNFTs.length}</div>
            <div className="text-[10px] font-bold tracking-widest mt-1" style={{ color: "rgba(200,247,197,0.25)" }}>NFTS</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 p-1.5 rounded-2xl w-fit" style={{ background: "rgba(200,247,197,0.04)" }}>
        {([
          { key: "nfts" as TabKey, label: "MY NFTS" },
          { key: "deploy" as TabKey, label: "DEPLOY" },
          { key: "auction" as TabKey, label: "AUCTION" },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-6 py-3 rounded-xl text-xs font-black tracking-wider transition-all"
            style={{
              background: tab === t.key ? "rgba(200,247,197,0.1)" : "transparent",
              color: tab === t.key ? "var(--mint)" : "rgba(200,247,197,0.25)",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "nfts" && <MyNFTsTab nfts={ownedNFTs} loading={isLoading} isOwn={isOwn} />}
      {tab === "deploy" && isOwn && <DeployWizard />}
      {tab === "deploy" && !isOwn && <NotOwnerMessage />}
      {tab === "auction" && <AuctionTab address={address} isOwn={isOwn} />}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/*  MY NFTS TAB — click NFT to sell/list       */
/* ═══════════════════════════════════════════ */
function MyNFTsTab({ nfts, loading, isOwn }: { nfts: NFTItem[]; loading: boolean; isOwn: boolean }) {
  const [filter, setFilter] = useState<"all" | "verified" | "external">("all");
  const [selectedNFT, setSelectedNFT] = useState<NFTItem | null>(null);
  const [price, setPrice] = useState("");
  const [step, setStep] = useState<"approve" | "list">("approve");

  const verified = nfts.filter(n => n.isVerified);
  const external = nfts.filter(n => !n.isVerified);
  const display = filter === "verified" ? verified : filter === "external" ? external : nfts;

  const { writeContract: approveWrite, data: approveTx, isPending: approvePending } = useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTx });

  const { writeContract: listWrite, data: listTx, isPending: listPending } = useWriteContract();
  const { isLoading: listConfirming, isSuccess: listSuccess } = useWaitForTransactionReceipt({ hash: listTx });

  function handleApprove() {
    if (!selectedNFT) return;
    approveWrite({
      address: selectedNFT.contract as `0x${string}`,
      abi: AIRitualNFT_ABI,
      functionName: "setApprovalForAll",
      args: [MARKETPLACE_ADDRESS, true],
      gas: 100000n,
    });
  }

  function handleList() {
    if (!selectedNFT || !price) return;
    listWrite({
      address: MARKETPLACE_ADDRESS,
      abi: RitualMarketplace_ABI,
      functionName: "list",
      args: [selectedNFT.contract as `0x${string}`, BigInt(selectedNFT.tokenId), parseEther(price)],
      gas: 200000n,
    });
  }

  // When approve succeeds, move to list step
  useEffect(() => {
    if (approveSuccess && step === "approve") {
      setStep("list");
    }
  }, [approveSuccess, step]);

  return (
    <div>
      {/* Sell modal */}
      {selectedNFT && isOwn && (
        <div className="glass-card p-6 mb-8 max-w-xl">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-black text-lg" style={{ color: "var(--mint)" }}>SELL NFT</h3>
            <button onClick={() => { setSelectedNFT(null); setPrice(""); setStep("approve"); }}
              className="text-xs font-bold px-3 py-1.5 rounded-xl"
              style={{ color: "rgba(200,247,197,0.4)", background: "rgba(200,247,197,0.06)" }}>
              CLOSE
            </button>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-2xl mb-5"
            style={{ background: "rgba(200,247,197,0.04)", border: "1px solid rgba(200,247,197,0.08)" }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm"
              style={{ background: "rgba(200,247,197,0.06)", color: "rgba(200,247,197,0.3)" }}>
              #{selectedNFT.tokenId}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate" style={{ color: "var(--mint)" }}>{selectedNFT.name || `Token #${selectedNFT.tokenId}`}</div>
              <div className="text-xs font-mono" style={{ color: "rgba(200,247,197,0.2)" }}><AddressDisplay address={selectedNFT.contract} /></div>
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-xs font-bold tracking-widest mb-2" style={{ color: "rgba(200,247,197,0.4)" }}>LISTING PRICE (RITUAL)</label>
            <input className="input-field" type="number" step="0.001" placeholder="0.1" value={price} onChange={e => setPrice(e.target.value)} />
          </div>

          {listSuccess ? (
            <div className="p-4 rounded-2xl text-center font-bold text-sm"
              style={{ background: "rgba(200,247,197,0.08)", border: "1px solid rgba(200,247,197,0.2)", color: "var(--mint)" }}>
              NFT listed successfully. Tx: {listTx?.slice(0, 18)}...
            </div>
          ) : (
            <div className="flex gap-3">
              <button className={`flex-1 font-black text-sm py-3 rounded-2xl transition-all ${step === "approve" ? "btn-primary" : "btn-secondary opacity-50"}`}
                onClick={handleApprove} disabled={approvePending || approveConfirming || step !== "approve"}>
                {approvePending ? "CONFIRM..." : approveConfirming ? "APPROVING..." : approveSuccess ? "APPROVED" : "1. APPROVE"}
              </button>
              <button className={`flex-1 font-black text-sm py-3 rounded-2xl transition-all ${step === "list" ? "btn-primary" : "btn-secondary opacity-50"}`}
                onClick={handleList} disabled={!price || listPending || listConfirming || step !== "list"}>
                {listPending ? "CONFIRM..." : listConfirming ? "LISTING..." : "2. LIST FOR SALE"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-3 mb-6">
        {(["all", "verified", "external"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-xl text-xs font-bold tracking-wider transition-all"
            style={{
              background: filter === f ? "rgba(200,247,197,0.08)" : "transparent",
              color: filter === f ? "var(--mint)" : "rgba(200,247,197,0.2)",
              border: `1px solid ${filter === f ? "rgba(200,247,197,0.15)" : "transparent"}`,
            }}>
            {f.toUpperCase()} <span className="ml-1 opacity-50">
              {f === "all" ? nfts.length : f === "verified" ? verified.length : external.length}
            </span>
          </button>
        ))}
      </div>

      <NFTGrid
        nfts={display}
        loading={loading}
        emptyMessage="No NFTs found in this wallet"
        onAction={isOwn ? (nft) => { setSelectedNFT(nft); setPrice(""); setStep("approve"); } : undefined}
        actionLabel={isOwn ? "SELL" : undefined}
      />
    </div>
  );
}


/* ═══════════════════════════════════════════ */
/*  AUCTION TAB — shows user's active listings */
/* ═══════════════════════════════════════════ */
function AuctionTab({ address, isOwn }: { address: string; isOwn: boolean }) {
  const { writeContract, data: cancelTx, isPending } = useWriteContract();
  const { isLoading: cancelConfirming, isSuccess: cancelSuccess } = useWaitForTransactionReceipt({ hash: cancelTx });

  // Read all factory collections to check listings
  const { data: allCollections } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: NFTFactory_ABI,
    functionName: "getAllCollections",
  });
  const collectionAddresses = (allCollections as `0x${string}`[]) ?? [];

  // Batch: tokensOfOwner per collection to find actual tokenIds
  const tokenCalls = collectionAddresses.map(addr => ({
    address: addr,
    abi: NFT_ABI_EXT,
    functionName: "tokensOfOwner",
    args: [address as `0x${string}`],
  }));
  const { data: tokenResults } = useReadContracts({
    contracts: tokenCalls as any[],
    query: { enabled: collectionAddresses.length > 0 && !!address },
  });

  // Build list of (contract, tokenId) pairs the wallet owns
  const ownedPairs: { contract: `0x${string}`; tokenId: bigint }[] = [];
  collectionAddresses.forEach((addr, i) => {
    const ids = tokenResults?.[i]?.result as bigint[] ?? [];
    for (const tid of ids) {
      ownedPairs.push({ contract: addr, tokenId: tid });
    }
  });

  // Check listing status for each owned token
  const listingCalls = ownedPairs.map(({ contract, tokenId }) => ({
    address: MARKETPLACE_ADDRESS,
    abi: RitualMarketplace_ABI,
    functionName: "getListing",
    args: [contract, tokenId],
  }));
  const { data: listingData } = useReadContracts({
    contracts: listingCalls as any[],
    query: { enabled: ownedPairs.length > 0 },
  });

  // Filter to active listings only
  const activeListings = ownedPairs
    .map((pair, i) => ({ ...pair, listing: listingData?.[i]?.result as any }))
    .filter(l => l.listing?.active === true);

  function handleCancel(contract: `0x${string}`, tokenId: bigint) {
    writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: RitualMarketplace_ABI,
      functionName: "cancelListing",
      args: [contract, tokenId],
      gas: 100000n,
    });
  }

  return (
    <div>
      <h2 className="font-display font-black text-2xl mb-2" style={{ color: "var(--mint)" }}>MY LISTINGS</h2>
      <p className="text-xs mb-8" style={{ color: "rgba(200,247,197,0.3)" }}>NFTs you have listed for sale on the marketplace</p>

      {activeListings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold"
            style={{ background: "rgba(200,247,197,0.04)", color: "rgba(200,247,197,0.15)" }}>
            0
          </div>
          <p className="font-bold" style={{ color: "rgba(200,247,197,0.25)" }}>No active listings</p>
          <p className="text-xs" style={{ color: "rgba(200,247,197,0.15)" }}>List NFTs from the My NFTs tab</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeListings.map(({ contract, tokenId, listing }) => (
            <div key={`${contract}-${tokenId}`} className="glass-card p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm"
                  style={{ background: "rgba(200,247,197,0.06)", color: "rgba(200,247,197,0.3)" }}>
                  #{tokenId.toString()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm" style={{ color: "var(--mint)" }}>
                    Token #{tokenId.toString()}
                  </div>
                  <div className="text-xs font-mono" style={{ color: "rgba(200,247,197,0.2)" }}>
                    {shortenAddress(contract)}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl text-center" style={{ background: "rgba(200,247,197,0.04)" }}>
                <div className="font-display font-black text-xl" style={{ color: "var(--mint)" }}>
                  {formatEther(BigInt(listing?.price ?? 0))} RITUAL
                </div>
                <div className="text-[10px] font-bold tracking-wider mt-1" style={{ color: "rgba(200,247,197,0.25)" }}>LISTED PRICE</div>
              </div>

              {isOwn && (
                <button className="btn-secondary w-full text-xs font-black py-2.5"
                  onClick={() => handleCancel(contract, tokenId)}
                  disabled={isPending || cancelConfirming}>
                  {isPending ? "CONFIRM..." : cancelConfirming ? "CANCELLING..." : cancelSuccess ? "CANCELLED" : "CANCEL LISTING"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/*  SHARED                                     */
/* ═══════════════════════════════════════════ */
function Field({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold tracking-widest mb-2" style={{ color: "rgba(200,247,197,0.4)" }}>{label}</label>
      <input className="input-field" type={type || "text"} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function NotOwnerMessage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-black"
        style={{ background: "rgba(200,247,197,0.04)", color: "rgba(200,247,197,0.15)" }}>
        X
      </div>
      <p className="font-bold" style={{ color: "rgba(200,247,197,0.3)" }}>Connect the wallet that owns this profile</p>
    </div>
  );
}
