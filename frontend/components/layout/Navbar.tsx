"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect } from "wagmi";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";

export default function Navbar() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl" style={{ background: "rgba(4, 15, 10, 0.85)", borderBottom: "1px solid rgba(200, 247, 197, 0.06)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <Image
              src="/logo.png"
              alt="The Cauldron"
              width={44}
              height={44}
              className="rounded-2xl transition-all duration-300 group-hover:shadow-lg"
              style={{ boxShadow: "0 4px 15px rgba(200, 247, 197, 0.15)" }}
            />
            <span className="font-display font-extrabold text-xl tracking-tight" style={{ color: "var(--mint)" }}>
              The<span style={{ opacity: 0.5 }}>Cauldron</span>
            </span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink href="/discover">Discover</NavLink>
            <NavLink href="/collections">Collections</NavLink>
          </div>

          {/* Profile / Connect */}
          <div className="flex items-center gap-4">
            {isConnected && address ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all duration-200"
                  style={{
                    background: dropdownOpen ? "rgba(200,247,197,0.1)" : "rgba(200,247,197,0.06)",
                    color: "var(--mint)",
                    border: `1px solid ${dropdownOpen ? "rgba(200,247,197,0.2)" : "rgba(200,247,197,0.08)"}`,
                  }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs"
                    style={{ background: "var(--mint)", color: "#040f0a" }}>
                    {address.slice(2, 4).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline">{address.slice(0, 6)}...{address.slice(-4)}</span>
                  <svg className={`w-4 h-4 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl overflow-hidden shadow-2xl animate-fade-in"
                    style={{ background: "#0a2e1f", border: "1px solid rgba(200,247,197,0.12)" }}>
                    <div className="p-2">
                      <DropdownLink href={`/profile/${address}?tab=nfts`} onClick={() => setDropdownOpen(false)}>
                        My NFTs
                      </DropdownLink>
                      <DropdownLink href={`/profile/${address}?tab=deploy`} onClick={() => setDropdownOpen(false)}>
                        Deploy
                      </DropdownLink>
                      <DropdownLink href="/collections/my" onClick={() => setDropdownOpen(false)}>
                        My Collections
                      </DropdownLink>
                      <DropdownLink href={`/profile/${address}?tab=auction`} onClick={() => setDropdownOpen(false)}>
                        Auction
                      </DropdownLink>
                      <div className="my-1" style={{ height: 1, background: "rgba(200,247,197,0.06)" }} />
                      <button
                        onClick={() => { disconnect(); setDropdownOpen(false); }}
                        className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all"
                        style={{ color: "rgba(255,120,120,0.7)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,120,120,0.06)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <ConnectButton
                chainStatus="icon"
                accountStatus="avatar"
                showBalance={false}
              />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
      style={{ color: "rgba(200, 247, 197, 0.45)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--mint)";
        e.currentTarget.style.background = "rgba(200, 247, 197, 0.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "rgba(200, 247, 197, 0.45)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </Link>
  );
}

function DropdownLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-4 py-3 rounded-xl text-sm font-bold transition-all"
      style={{ color: "rgba(200,247,197,0.6)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(200,247,197,0.06)";
        e.currentTarget.style.color = "var(--mint)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "rgba(200,247,197,0.6)";
      }}
    >
      {children}
    </Link>
  );
}
