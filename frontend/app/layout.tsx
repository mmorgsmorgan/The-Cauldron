import type { Metadata } from "next";
import { Providers } from "./providers";
import Navbar from "@/components/layout/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Cauldron — NFT Forge on Ritual Chain",
  description:
    "The primary NFT launchpad on Ritual Chain. Deploy collections, mint with allowlists, trade with royalties, and view your entire chain-wide portfolio.",
  keywords: ["NFT", "Ritual Chain", "Launchpad", "AI", "ERC721", "Marketplace", "The Cauldron"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-grid min-h-screen">
        {/* Background glow orbs */}
        <div
          className="glow-orb"
          style={{ width: 600, height: 600, top: -200, left: -150, background: "#0e3d29" }}
        />
        <div
          className="glow-orb"
          style={{ width: 500, height: 500, bottom: -100, right: -100, background: "#134d34" }}
        />
        <div
          className="glow-orb"
          style={{ width: 300, height: 300, top: "40%", left: "60%", background: "#1a5e40" }}
        />

        <Providers>
          <Navbar />
          <main className="relative z-10 min-h-[calc(100vh-80px)]">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
