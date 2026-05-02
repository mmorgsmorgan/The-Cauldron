"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther } from "viem";
import { AIRitualNFT_ABI } from "@/lib/contracts";
import { resolveIPFSGateway } from "@/lib/pinata";
import { fetchMerkleProof } from "@/lib/api";

const NFT_ABI = [
  ...AIRitualNFT_ABI,
  { inputs: [], name: "name", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "owner", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "baseURI", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
] as const;

type Phase = {
  startTime: bigint;
  endTime: bigint;
  price: bigint;
  maxPerWallet: number;
  merkleRoot: `0x${string}`;
  isPublic: boolean;
};

export default function MintPage() {
  const params = useParams();
  const contractAddress = params.address as `0x${string}`;
  const { address: userAddress } = useAccount();
  const [quantity, setQuantity] = useState(1);
  // Ritual Chain uses millisecond block.timestamp
  const [now, setNow] = useState(Math.floor(Date.now()));
  const [localMeta, setLocalMeta] = useState<{ name?: string; image?: string; description?: string } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now())), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load locally cached metadata (saved at deploy time)
  useEffect(() => {
    if (!contractAddress) return;
    try {
      const saved = localStorage.getItem(`cauldron_meta_${contractAddress.toLowerCase()}`);
      if (saved) setLocalMeta(JSON.parse(saved));
    } catch {}
  }, [contractAddress]);

  const { data: name } = useReadContract({ address: contractAddress, abi: NFT_ABI, functionName: "name" });
  const { data: symbol } = useReadContract({ address: contractAddress, abi: NFT_ABI, functionName: "symbol" });
  const { data: maxSupply } = useReadContract({ address: contractAddress, abi: NFT_ABI, functionName: "maxSupply" });
  // Use totalSupply (ERC721A) — safe for proxy clones unlike totalMinted which can underflow
  const { data: totalSupplyRaw } = useReadContract({ address: contractAddress, abi: NFT_ABI, functionName: "totalSupply" });
  const { data: totalPhases } = useReadContract({ address: contractAddress, abi: NFT_ABI, functionName: "totalPhases" });
  const { data: onChainBaseURI } = useReadContract({ address: contractAddress, abi: NFT_ABI, functionName: "baseURI" });

  const { data: phase0 } = useReadContract({ address: contractAddress, abi: AIRitualNFT_ABI, functionName: "getPhase", args: [0n] });
  const { data: phase1 } = useReadContract({ address: contractAddress, abi: AIRitualNFT_ABI, functionName: "getPhase", args: [1n], query: { enabled: (totalPhases ?? 0n) > 1n } });

  const phases: Phase[] = [phase0, phase1].filter(Boolean) as Phase[];

  const activePhaseIdx = phases.findIndex(p => now >= Number(p.startTime) && now <= Number(p.endTime));
  const activePhase = activePhaseIdx >= 0 ? phases[activePhaseIdx] : null;
  const upcomingPhase = phases.find(p => now < Number(p.startTime));

  // Check how many this wallet has already minted in the active phase
  const { data: mintedByUser } = useReadContract({
    address: contractAddress,
    abi: AIRitualNFT_ABI,
    functionName: "mintedPerWalletPerPhase",
    args: [BigInt(Math.max(activePhaseIdx, 0)), userAddress!],
    query: { enabled: !!userAddress && activePhaseIdx >= 0 },
  });
  const alreadyMinted = Number(mintedByUser ?? 0n);
  const remainingAllowance = activePhase ? Math.max(0, activePhase.maxPerWallet - alreadyMinted) : 0;
  const walletLimitReached = activePhase ? alreadyMinted >= activePhase.maxPerWallet : false;

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  async function handleMint() {
    if (!activePhase || !userAddress) return;
    const totalCost = activePhase.price * BigInt(quantity);
    if (activePhase.isPublic) {
      writeContract({
        address: contractAddress,
        abi: AIRitualNFT_ABI,
        functionName: "publicMint",
        args: [BigInt(activePhaseIdx), BigInt(quantity)],
        value: totalCost,
        gas: 200000n,
      });
    } else {
      // Fetch the real Merkle proof from the backend
      let proof: `0x${string}`[] = [];
      try {
        const merkleRoot = activePhase.merkleRoot;
        const result = await fetchMerkleProof(merkleRoot, userAddress);
        if (!result.valid) {
          alert("Your wallet is not on the allowlist for this phase.");
          return;
        }
        proof = result.proof as `0x${string}`[];
      } catch (err) {
        console.error("Failed to fetch Merkle proof:", err);
        alert("Could not verify allowlist status. Please try again.");
        return;
      }
      writeContract({
        address: contractAddress,
        abi: AIRitualNFT_ABI,
        functionName: "allowlistMint",
        args: [BigInt(activePhaseIdx), BigInt(quantity), proof],
        value: totalCost,
        gas: 200000n,
      });
    }
  }

  const supplyBig = maxSupply ?? 0n;
  const rawMintedBig = totalSupplyRaw ?? 0n;
  // ERC721A proxy clones don't run the constructor so _currentIndex stays 0.
  // totalSupply() = _currentIndex - _startTokenId() underflows to ~2^256.
  // Detect: if rawMinted > maxSupply it's underflow → treat as 0.
  const mintedBig = (supplyBig > 0n && rawMintedBig > supplyBig) ? 0n : rawMintedBig;
  const minted = Number(mintedBig);
  const supply = Number(supplyBig);
  const isSoldOut = supply > 0 && minted >= supply;
  const progress = supply > 0 ? (minted / supply) * 100 : 0;


  // Image: prefer locally cached URL, fall back to on-chain baseURI
  const rawImage = localMeta?.image || (onChainBaseURI as string) || "";
  const imageUrl = rawImage ? resolveIPFSGateway(rawImage) : "";

  function formatCountdown(targetTs: number): string {
    const diffMs = targetTs - now;
    if (diffMs <= 0) return "Live now";
    const diffSec = Math.floor(diffMs / 1000);
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-10 items-start">

          {/* Left — Image + Phases */}
          <div className="space-y-4">
            <div className="rounded-3xl overflow-hidden aspect-square"
              style={{ background: "rgba(200,247,197,0.04)", border: "1px solid rgba(200,247,197,0.08)" }}>
              {imageUrl ? (
                <img src={imageUrl} alt={name as string} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <div className="font-display font-black text-6xl" style={{ color: "rgba(200,247,197,0.08)" }}>
                    {symbol?.toString().slice(0, 2) ?? "??"}
                  </div>
                  <p className="text-[10px]" style={{ color: "rgba(200,247,197,0.15)" }}>No image cached</p>
                </div>
              )}
            </div>

            {/* Phases Timeline */}
            {phases.length > 0 && (
              <div className="glass-card p-5 space-y-3">
                <div className="text-xs font-black tracking-widest" style={{ color: "rgba(200,247,197,0.3)" }}>PHASES</div>
                {phases.map((p, i) => {
                  const isActive = now >= Number(p.startTime) && now <= Number(p.endTime);
                  const isPast = now > Number(p.endTime);
                  const isFuture = now < Number(p.startTime);
                  return (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl transition-all"
                      style={{
                        background: isActive ? "rgba(200,247,197,0.08)" : "rgba(200,247,197,0.02)",
                        border: `1px solid ${isActive ? "rgba(200,247,197,0.2)" : "rgba(200,247,197,0.05)"}`,
                      }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: isActive ? "var(--mint)" : isPast ? "rgba(200,247,197,0.15)" : "rgba(200,247,197,0.05)" }} />
                      <div className="flex-1">
                        <div className="text-xs font-black" style={{ color: isActive ? "var(--mint)" : "rgba(200,247,197,0.3)" }}>
                          {p.isPublic ? "PUBLIC SALE" : "ALLOWLIST"}{isActive ? " ● LIVE" : isPast ? " · ENDED" : ""}
                        </div>
                        <div className="text-[10px] mt-0.5" style={{ color: "rgba(200,247,197,0.2)" }}>
                          {formatEther(p.price)} RITUAL · max {p.maxPerWallet}/wallet
                          {isFuture && ` · starts in ${formatCountdown(Number(p.startTime))}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right — Mint card */}
          <div className="space-y-6">
            <div>
              <div className="text-xs font-mono tracking-widest mb-2" style={{ color: "rgba(200,247,197,0.2)" }}>
                {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
              </div>
              <h1 className="font-display font-black text-4xl" style={{ color: "var(--mint)" }}>
                {(name as string | undefined) || localMeta?.name || "Loading..."}
              </h1>
              <p className="text-sm font-mono mt-1" style={{ color: "rgba(200,247,197,0.3)" }}>{symbol?.toString()}</p>
              {localMeta?.description && (
                <p className="text-sm mt-3" style={{ color: "rgba(200,247,197,0.4)" }}>{localMeta.description}</p>
              )}
            </div>

            {/* Progress */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex justify-between text-xs font-bold">
                <span style={{ color: "rgba(200,247,197,0.4)" }}>MINTED</span>
                <span style={{ color: "var(--mint)" }}>{minted} / {supply}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(200,247,197,0.06)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%`, background: "var(--mint)" }} />
              </div>
              <div className="text-[10px]" style={{ color: "rgba(200,247,197,0.2)" }}>
                {isSoldOut ? "SOLD OUT" : `${(100 - progress).toFixed(1)}% remaining`}
              </div>
            </div>

            {/* Mint interface */}
            {isSuccess ? (
              <div className="glass-card p-6 text-center space-y-4">
                <div className="text-4xl" style={{ color: "var(--mint)" }}>✓</div>
                <div className="font-display font-black text-xl" style={{ color: "var(--mint)" }}>MINTED!</div>
                <p className="text-xs" style={{ color: "rgba(200,247,197,0.4)" }}>You minted {quantity} token{quantity > 1 ? "s" : ""}</p>
                <a href={`https://explorer.ritualfoundation.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  className="btn-secondary text-xs px-5 py-2.5 inline-block font-bold">VIEW ON EXPLORER</a>
              </div>
            ) : isSoldOut ? (
              <div className="glass-card p-6 text-center">
                <div className="font-display font-black text-xl" style={{ color: "rgba(200,247,197,0.3)" }}>SOLD OUT</div>
              </div>
            ) : walletLimitReached ? (
              <div className="glass-card p-6 text-center space-y-3">
                <div className="text-3xl" style={{ color: "var(--mint)" }}>✓</div>
                <div className="font-display font-black text-xl" style={{ color: "var(--mint)" }}>LIMIT REACHED</div>
                <p className="text-xs" style={{ color: "rgba(200,247,197,0.3)" }}>
                  You've minted {alreadyMinted}/{activePhase?.maxPerWallet} in this phase
                </p>
              </div>
            ) : activePhase ? (
              <div className="glass-card p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold tracking-widest" style={{ color: "rgba(200,247,197,0.4)" }}>
                      {activePhase.isPublic ? "PUBLIC SALE" : "ALLOWLIST"} — LIVE
                    </div>
                    <div className="font-display font-black text-2xl mt-1" style={{ color: "var(--mint)" }}>
                      {formatEther(activePhase.price)} RITUAL
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "rgba(200,247,197,0.25)" }}>
                      per token · {alreadyMinted}/{activePhase.maxPerWallet} minted by you
                    </div>
                  </div>
                  <div className="text-xs text-right" style={{ color: "rgba(200,247,197,0.25)" }}>
                    Ends in<br />
                    <span className="font-mono font-bold" style={{ color: "rgba(200,247,197,0.5)" }}>
                      {formatCountdown(Number(activePhase.endTime))}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold tracking-widest mb-2" style={{ color: "rgba(200,247,197,0.4)" }}>
                    QUANTITY <span style={{ color: "rgba(200,247,197,0.2)" }}>({remainingAllowance} remaining)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 rounded-xl font-black text-lg transition-all"
                      style={{ background: "rgba(200,247,197,0.06)", color: "var(--mint)", border: "1px solid rgba(200,247,197,0.1)" }}>−</button>
                    <div className="flex-1 text-center font-display font-black text-2xl" style={{ color: "var(--mint)" }}>{quantity}</div>
                    <button onClick={() => setQuantity(Math.min(remainingAllowance, quantity + 1))}
                      className="w-10 h-10 rounded-xl font-black text-lg transition-all"
                      style={{ background: "rgba(200,247,197,0.06)", color: "var(--mint)", border: "1px solid rgba(200,247,197,0.1)" }}>+</button>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl" style={{ background: "rgba(200,247,197,0.04)" }}>
                  <span className="text-xs font-bold" style={{ color: "rgba(200,247,197,0.4)" }}>TOTAL</span>
                  <span className="font-display font-black text-xl" style={{ color: "var(--mint)" }}>
                    {(parseFloat(formatEther(activePhase.price)) * quantity).toFixed(4)} RITUAL
                  </span>
                </div>

                <button onClick={handleMint} disabled={!userAddress || isPending || isConfirming || remainingAllowance === 0}
                  className="btn-primary w-full py-4 text-sm font-black">
                  {!userAddress ? "CONNECT WALLET TO MINT" : isPending ? "CONFIRM IN WALLET..." : isConfirming ? "MINTING..." : `MINT ${quantity} TOKEN${quantity > 1 ? "S" : ""}`}
                </button>
              </div>
            ) : upcomingPhase ? (
              <div className="glass-card p-6 text-center space-y-3">
                <div className="text-xs font-black tracking-widest" style={{ color: "rgba(200,247,197,0.3)" }}>MINT STARTS IN</div>
                <div className="font-display font-black text-3xl" style={{ color: "var(--mint)" }}>
                  {formatCountdown(Number(upcomingPhase.startTime))}
                </div>
                <div className="text-xs" style={{ color: "rgba(200,247,197,0.2)" }}>
                  {upcomingPhase.isPublic ? "Public Sale" : "Allowlist"} · {formatEther(upcomingPhase.price)} RITUAL
                </div>
              </div>
            ) : (
              <div className="glass-card p-6 text-center">
                <div className="font-display font-black text-xl" style={{ color: "rgba(200,247,197,0.3)" }}>MINT ENDED</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
