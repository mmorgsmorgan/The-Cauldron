import { defineChain } from "viem";

export const ritualChain = defineChain({
  id: 1979,
  name: "Ritual Chain",
  nativeCurrency: {
    name: "Ritual",
    symbol: "RITUAL",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RITUAL_RPC || "https://rpc.ritualfoundation.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "RitualScan",
      url: process.env.NEXT_PUBLIC_EXPLORER || "https://explorer.ritualfoundation.org",
    },
  },
});
