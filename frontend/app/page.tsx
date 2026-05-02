"use client";

import Link from "next/link";
import { useAccount } from "wagmi";

export default function HomePage() {
  const { address } = useAccount();

  return (
    <div className="relative animate-fade-in">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 pt-24 pb-36">
        <div className="text-center space-y-8">
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full"
            style={{ background: "rgba(200,247,197,0.06)", border: "1px solid rgba(200,247,197,0.1)" }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--mint)" }} />
            <span className="text-sm font-semibold" style={{ color: "rgba(200,247,197,0.7)" }}>
              Live on Ritual Chain
            </span>
          </div>

          <h1 className="font-display font-black leading-[0.95] tracking-tight">
            <span className="block text-6xl md:text-8xl" style={{ color: "var(--mint)" }}>
              THE
            </span>
            <span className="block text-7xl md:text-9xl gradient-text mt-2">
              CAULDRON
            </span>
            <span className="block text-4xl md:text-5xl mt-4" style={{ color: "rgba(200,247,197,0.4)" }}>
              NFT FORGE ON RITUAL CHAIN
            </span>
          </h1>

          <p className="text-base md:text-lg max-w-xl mx-auto leading-relaxed" style={{ color: "rgba(200,247,197,0.35)" }}>
            Deploy collections. Mint with allowlists. Trade with royalties.
            View <span style={{ color: "var(--mint)", fontWeight: 700 }}>every NFT</span> across the entire chain.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Link href="/discover" className="btn-primary text-base px-10 py-4 font-black tracking-wide">
              DISCOVER NFTS
            </Link>
            <Link href="/collections" className="btn-secondary text-base px-10 py-4 font-black tracking-wide">
              COLLECTIONS
            </Link>
            {address && (
              <Link href={`/profile/${address}`} className="btn-secondary text-base px-10 py-4 font-black tracking-wide">
                MY PROFILE →
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
