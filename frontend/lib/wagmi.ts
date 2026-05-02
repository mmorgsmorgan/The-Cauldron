"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { ritualChain } from "./chains";

export const wagmiConfig = getDefaultConfig({
  appName: "The Cauldron",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [ritualChain],
  ssr: true,
});
