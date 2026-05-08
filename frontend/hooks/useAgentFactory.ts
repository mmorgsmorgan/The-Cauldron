"use client";

import { useState, useCallback } from "react";
import { useAccount, useReadContract, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { encodeFunctionData, keccak256, toBytes } from "viem";
import {
  SOVEREIGN_FACTORY,
  SOVEREIGN_FACTORY_ABI,
  TEE_SERVICE_REGISTRY,
  TEE_REGISTRY_ABI,
  ASYNC_JOB_TRACKER,
  ASYNC_JOB_TRACKER_ABI,
  RITUAL_WALLET,
  RITUAL_WALLET_ABI,
  type AgentStrategy,
  calculateFunding,
} from "@/lib/agent-factory";

// ── Executor Discovery ──
export function useExecutorDiscovery() {
  const { data, isLoading, error } = useReadContract({
    address: TEE_SERVICE_REGISTRY,
    abi: TEE_REGISTRY_ABI,
    functionName: "getServicesByCapability",
    args: [0, true], // HTTP_CALL capability, check validity
  });

  const executors = data as Array<{
    node: {
      paymentAddress: `0x${string}`;
      teeAddress: `0x${string}`;
      publicKey: `0x${string}`;
      endpoint: string;
    };
    isValid: boolean;
  }> | undefined;

  const firstExecutor = executors?.[0]?.node;

  return {
    executor: firstExecutor?.teeAddress,
    executorPublicKey: firstExecutor?.publicKey,
    executorCount: executors?.length ?? 0,
    isLoading,
    error,
  };
}

// ── Predict Harness Address ──
export function usePredictHarness(userSalt?: `0x${string}`) {
  const { address } = useAccount();

  const { data } = useReadContract({
    address: SOVEREIGN_FACTORY,
    abi: SOVEREIGN_FACTORY_ABI,
    functionName: "predictHarness",
    args: address && userSalt ? [address, userSalt] : undefined,
    query: { enabled: !!address && !!userSalt },
  });

  return {
    harnessAddress: (data as [string, string] | undefined)?.[0] as `0x${string}` | undefined,
    childSalt: (data as [string, string] | undefined)?.[1] as `0x${string}` | undefined,
  };
}

// ── Sender Lock Check ──
export function useSenderLock() {
  const { address } = useAccount();

  const { data: isLocked, refetch } = useReadContract({
    address: ASYNC_JOB_TRACKER,
    abi: ASYNC_JOB_TRACKER_ABI,
    functionName: "hasPendingJobForSender",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  return {
    isLocked: isLocked as boolean ?? false,
    refetch,
  };
}

// ── RitualWallet Balance ──
export function useRitualWalletBalance(address?: `0x${string}`) {
  const { data: balance } = useReadContract({
    address: RITUAL_WALLET,
    abi: RITUAL_WALLET_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10000 },
  });

  return {
    balance: balance as bigint ?? 0n,
    formatted: balance ? (Number(balance as bigint) / 1e18).toFixed(4) : "0",
  };
}

// ── Deploy Agent ──
export type DeployStatus =
  | "idle"
  | "generating_salt"
  | "predicting"
  | "deploying"
  | "confirming"
  | "success"
  | "error";

export function useDeployAgent() {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const [status, setStatus] = useState<DeployStatus>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [harnessAddress, setHarnessAddress] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | undefined>();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const deploy = useCallback(async (strategy: AgentStrategy) => {
    if (!address) {
      setError("Connect wallet first");
      return;
    }

    try {
      setStatus("generating_salt");
      setError(undefined);

      // Generate deterministic salt from user address + timestamp
      const saltInput = `${address}-${Date.now()}-${strategy.mode}`;
      const userSalt = keccak256(toBytes(saltInput));

      setStatus("deploying");

      // Deploy harness via factory
      const data = encodeFunctionData({
        abi: SOVEREIGN_FACTORY_ABI,
        functionName: "deployHarness",
        args: [userSalt],
      });

      const hash = await sendTransactionAsync({
        to: SOVEREIGN_FACTORY,
        data,
        gas: 500_000n,
      });

      setTxHash(hash);
      setStatus("confirming");

      // Store agent info locally
      const funding = calculateFunding(strategy);
      const agentInfo = {
        owner: address,
        userSalt,
        txHash: hash,
        strategy: {
          ...strategy,
          maxPricePerNFT: strategy.maxPricePerNFT.toString(),
          totalBudget: strategy.totalBudget.toString(),
          apiKey: "", // never persist plaintext key
        },
        funding: {
          total: funding.total.toString(),
          executionFees: funding.executionFees.toString(),
          tradingBudget: funding.tradingBudget.toString(),
        },
        deployedAt: Date.now(),
        status: "deployed",
      };

      // Save to localStorage
      const agents = JSON.parse(localStorage.getItem("cauldron_agents") || "[]");
      agents.push(agentInfo);
      localStorage.setItem("cauldron_agents", JSON.stringify(agents));

      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Deploy failed");
    }
  }, [address, sendTransactionAsync]);

  return {
    deploy,
    status,
    txHash,
    harnessAddress,
    isConfirming,
    isSuccess,
    error,
    reset: () => {
      setStatus("idle");
      setTxHash(undefined);
      setHarnessAddress(undefined);
      setError(undefined);
    },
  };
}

// ── Get Deployed Agents ──
export function useMyAgents() {
  const { address } = useAccount();
  const [agents, setAgents] = useState<Array<Record<string, unknown>>>([]);

  const refresh = useCallback(() => {
    if (!address) return;
    const all = JSON.parse(localStorage.getItem("cauldron_agents") || "[]");
    const mine = all.filter((a: Record<string, unknown>) =>
      (a.owner as string)?.toLowerCase() === address.toLowerCase()
    );
    setAgents(mine);
  }, [address]);

  // Refresh on mount
  useState(() => { refresh(); });

  return { agents, refresh };
}
