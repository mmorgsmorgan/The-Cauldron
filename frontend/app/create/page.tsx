"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, zeroHash } from "viem";
import { FACTORY_ADDRESS, NFTFactory_ABI } from "@/lib/contracts";
import { generateMerkleRoot } from "@/lib/api";

export default function CreatePage() {
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState(1);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [baseURI, setBaseURI] = useState("");
  const [maxSupply, setMaxSupply] = useState("1000");
  const [royaltyFee, setRoyaltyFee] = useState("5");

  const [gtdPrice, setGtdPrice] = useState("0.01");
  const [gtdMaxPerWallet, setGtdMaxPerWallet] = useState("3");
  const [gtdDuration, setGtdDuration] = useState("3600");
  const [publicPrice, setPublicPrice] = useState("0.02");
  const [publicMaxPerWallet, setPublicMaxPerWallet] = useState("5");
  const [publicDuration, setPublicDuration] = useState("7200");

  const [allowlistCSV, setAllowlistCSV] = useState("");
  const [merkleRoot, setMerkleRoot] = useState<`0x${string}`>(zeroHash);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  async function handleGenerateMerkle() {
    if (!allowlistCSV.trim()) return;
    const addresses = allowlistCSV.split(/[,\n\r]+/).map(a => a.trim()).filter(a => a.startsWith("0x"));
    if (addresses.length === 0) return alert("No valid addresses");
    try {
      const result = await generateMerkleRoot(addresses);
      setMerkleRoot(result.root as `0x${string}`);
      alert(`Root generated for ${result.count} addresses`);
    } catch { alert("Failed to generate"); }
  }

  function handleDeploy() {
    if (!isConnected || !address) return;
    const now = Math.floor(Date.now() / 1000);
    const phases = [
      { startTime: BigInt(now), endTime: BigInt(now + parseInt(gtdDuration)), price: parseEther(gtdPrice), maxPerWallet: parseInt(gtdMaxPerWallet), merkleRoot, isPublic: false },
      { startTime: BigInt(now + parseInt(gtdDuration)), endTime: BigInt(now + parseInt(gtdDuration) + parseInt(publicDuration)), price: parseEther(publicPrice), maxPerWallet: parseInt(publicMaxPerWallet), merkleRoot: zeroHash, isPublic: true },
    ];
    writeContract({
      address: FACTORY_ADDRESS, abi: NFTFactory_ABI, functionName: "createCollection",
      args: [name, symbol, baseURI, BigInt(maxSupply), address, BigInt(Math.round(parseFloat(royaltyFee) * 100)), phases],
    });
  }

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-24 text-center animate-fade-in">
        <div className="font-display font-black text-4xl mb-4" style={{ color: "var(--mint)" }}>CONNECT WALLET</div>
        <p style={{ color: "rgba(200,247,197,0.35)" }}>Connect your wallet to create a collection.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 animate-fade-in">
      <h1 className="font-display font-black text-4xl mb-1" style={{ color: "var(--mint)" }}>CREATE</h1>
      <p className="mb-8 text-sm" style={{ color: "rgba(200,247,197,0.3)" }}>Deploy an ERC-721A collection on Ritual Chain</p>

      {/* Progress */}
      <div className="flex items-center gap-3 mb-10">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-3 flex-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black transition-all"
              style={{
                background: step >= s ? "var(--mint)" : "rgba(200,247,197,0.06)",
                color: step >= s ? "#040f0a" : "rgba(200,247,197,0.2)",
              }}>
              {s}
            </div>
            <span className="text-xs font-bold tracking-wide" style={{ color: step >= s ? "var(--mint)" : "rgba(200,247,197,0.15)" }}>
              {s === 1 ? "DETAILS" : s === 2 ? "PHASES" : "DEPLOY"}
            </span>
            {s < 3 && <div className="flex-1 h-px" style={{ background: step > s ? "rgba(200,247,197,0.3)" : "rgba(200,247,197,0.06)" }} />}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="glass-card p-8 space-y-6">
          <Field label="COLLECTION NAME" value={name} onChange={setName} placeholder="Ritual Genesis" />
          <Field label="SYMBOL" value={symbol} onChange={setSymbol} placeholder="RGEN" />
          <Field label="BASE URI (IPFS)" value={baseURI} onChange={setBaseURI} placeholder="ipfs://Qm.../metadata/" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="MAX SUPPLY" value={maxSupply} onChange={setMaxSupply} type="number" />
            <Field label="ROYALTY %" value={royaltyFee} onChange={setRoyaltyFee} type="number" />
          </div>
          <button className="btn-primary w-full font-black tracking-wide" onClick={() => setStep(2)} disabled={!name || !symbol}>
            NEXT: PHASES →
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="glass-card p-8 space-y-6">
          <h3 className="font-display font-black text-lg tracking-wide" style={{ color: "var(--mint)" }}>PHASE 1 — GTD</h3>
          <div className="grid grid-cols-3 gap-4">
            <Field label="PRICE" value={gtdPrice} onChange={setGtdPrice} type="number" />
            <Field label="MAX/WALLET" value={gtdMaxPerWallet} onChange={setGtdMaxPerWallet} type="number" />
            <Field label="DURATION (S)" value={gtdDuration} onChange={setGtdDuration} type="number" />
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest mb-2" style={{ color: "rgba(200,247,197,0.4)" }}>ALLOWLIST</label>
            <textarea className="input-field h-24 resize-none font-mono text-xs" placeholder={"0xABC...\n0xDEF..."} value={allowlistCSV} onChange={e => setAllowlistCSV(e.target.value)} />
            <button className="btn-secondary text-xs mt-2 px-4 py-2" onClick={handleGenerateMerkle}>GENERATE ROOT</button>
            {merkleRoot !== zeroHash && <p className="text-xs mt-1 font-mono break-all" style={{ color: "rgba(200,247,197,0.4)" }}>Root: {merkleRoot}</p>}
          </div>

          <div className="divider" />
          <h3 className="font-display font-black text-lg tracking-wide" style={{ color: "var(--mint)" }}>PHASE 2 — PUBLIC</h3>
          <div className="grid grid-cols-3 gap-4">
            <Field label="PRICE" value={publicPrice} onChange={setPublicPrice} type="number" />
            <Field label="MAX/WALLET" value={publicMaxPerWallet} onChange={setPublicMaxPerWallet} type="number" />
            <Field label="DURATION (S)" value={publicDuration} onChange={setPublicDuration} type="number" />
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary flex-1 font-black" onClick={() => setStep(1)}>← BACK</button>
            <button className="btn-primary flex-1 font-black" onClick={() => setStep(3)}>REVIEW →</button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="glass-card p-8 space-y-6">
          <h3 className="font-display font-black text-lg tracking-wide" style={{ color: "var(--mint)" }}>REVIEW & DEPLOY</h3>
          <div className="space-y-0">
            {[
              ["Name", name], ["Symbol", symbol], ["Max Supply", maxSupply],
              ["Royalty", `${royaltyFee}%`], ["GTD Price", `${gtdPrice} RITUAL`],
              ["Public Price", `${publicPrice} RITUAL`],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between py-3" style={{ borderBottom: "1px solid rgba(200,247,197,0.05)" }}>
                <span className="text-xs font-bold tracking-wide" style={{ color: "rgba(200,247,197,0.3)" }}>{l}</span>
                <span className="text-sm font-bold" style={{ color: "var(--mint)" }}>{v}</span>
              </div>
            ))}
          </div>
          {isSuccess ? (
            <div className="p-5 rounded-2xl text-center font-bold" style={{ background: "rgba(200,247,197,0.08)", border: "1px solid rgba(200,247,197,0.2)", color: "var(--mint)" }}>
              ✅ Collection deployed! Tx: {txHash?.slice(0, 14)}...
            </div>
          ) : (
            <div className="flex gap-3">
              <button className="btn-secondary flex-1 font-black" onClick={() => setStep(2)}>← BACK</button>
              <button className="btn-primary flex-1 font-black" onClick={handleDeploy} disabled={isPending || isConfirming}>
                {isPending ? "CONFIRM IN WALLET..." : isConfirming ? "DEPLOYING..." : "🚀 DEPLOY"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold tracking-widest mb-2" style={{ color: "rgba(200,247,197,0.4)" }}>{label}</label>
      <input className="input-field" type={type || "text"} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
