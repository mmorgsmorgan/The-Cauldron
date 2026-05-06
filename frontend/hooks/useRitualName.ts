"use client";

import { useState, useEffect, useCallback } from "react";
import { resolve, resolveName, loadNames, refresh, registrySize } from "@/lib/names";

/**
 * useRitualName — resolve a single address to its Ritual Name
 * 
 * Returns the name if registered, otherwise a shortened address.
 * Updates reactively when the registry loads.
 */
export function useRitualName(address: string | undefined | null): {
  display: string;
  name: string | null;
  loading: boolean;
} {
  const [display, setDisplay] = useState<string>(() => {
    // Immediate render from existing cache
    return address ? resolve(address) : "unknown";
  });
  const [name, setName] = useState<string | null>(() => {
    return address ? resolveName(address) : null;
  });
  const [loading, setLoading] = useState(registrySize() === 0);

  useEffect(() => {
    if (!address) return;
    
    let cancelled = false;
    setLoading(true);
    
    loadNames().then(() => {
      if (cancelled) return;
      setDisplay(resolve(address));
      setName(resolveName(address));
      setLoading(false);
    });
    
    return () => { cancelled = true; };
  }, [address]);

  return { display, name, loading };
}

/**
 * useRitualNames — resolve multiple addresses at once
 * Returns a map of address → display name
 */
export function useRitualNames(addresses: (string | undefined | null)[]): {
  resolve: (address: string | undefined | null) => string;
  loading: boolean;
} {
  const [ready, setReady] = useState(registrySize() > 0);
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadNames().then(() => {
      if (cancelled) return;
      setReady(true);
      setTick(t => t + 1);
    });
    return () => { cancelled = true; };
  }, []);

  const resolveAddr = useCallback((address: string | undefined | null) => {
    return resolve(address);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return { resolve: resolveAddr, loading: !ready };
}

/**
 * useNamesRegistry — access the registry state (size, refresh)
 */
export function useNamesRegistry() {
  const [size, setSize] = useState(registrySize());
  const [refreshing, setRefreshing] = useState(false);

  const forceRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setSize(registrySize());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadNames().then(() => setSize(registrySize()));
  }, []);

  return { size, refreshing, forceRefresh };
}
