"use client";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { useEffect } from "react";
import { loadNames } from "@/lib/names";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

/** Pre-warm name registry at app start — non-blocking */
function NamesLoader() {
  useEffect(() => {
    loadNames().catch(() => {}); // graceful — never blocks render
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#c8f7c5",
            accentColorForeground: "#040f0a",
            borderRadius: "large",
            overlayBlur: "small",
            fontStack: "system",
          })}
        >
          <NamesLoader />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
