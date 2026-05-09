"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, usePublicClient, useReadContract, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { encodeFunctionData, keccak256, toBytes, decodeAbiParameters } from "viem";
import {
  SOVEREIGN_FACTORY,
  SOVEREIGN_FACTORY_ABI,
  SOVEREIGN_HARNESS_ABI,
  TEE_SERVICE_REGISTRY,
  TEE_REGISTRY_ABI,
  ASYNC_JOB_TRACKER,
  ASYNC_JOB_TRACKER_ABI,
  RITUAL_WALLET,
  RITUAL_WALLET_ABI,
  type AgentStrategy,
  calculateFunding,
  buildSovereignParams,
  buildScheduleConfig,
  buildRollingConfig,
} from "@/lib/agent-factory";
import { MARKETPLACE_ADDRESS } from "@/lib/contracts";

// ── Executor Discovery ──
export function useExecutorDiscovery() {
  const { data, isLoading, error } = useReadContract({
    address: TEE_SERVICE_REGISTRY,
    abi: TEE_REGISTRY_ABI,
    functionName: "getServicesByCapability",
    args: [0, true],
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

// ── Deploy Agent (Two-Step: deployHarness → configureFundAndStart) ──
export type DeployStatus =
  | "idle"
  | "deploying_harness"
  | "confirming_harness"
  | "configuring"
  | "confirming_config"
  | "success"
  | "error";

export function useDeployAgent() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();
  const [status, setStatus] = useState<DeployStatus>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [configTxHash, setConfigTxHash] = useState<`0x${string}` | undefined>();
  const [harnessAddress, setHarnessAddress] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [strategyRef, setStrategyRef] = useState<AgentStrategy | null>(null);

  // Watch harness deploy receipt
  const { data: harnessReceipt } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash && status === "confirming_harness" },
  });

  // Watch config receipt
  const { data: configReceipt, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: configTxHash,
    query: { enabled: !!configTxHash && status === "confirming_config" },
  });

  const isSuccess = configReceipt?.status === "success";
  const isFailed = harnessReceipt?.status === "reverted" || configReceipt?.status === "reverted";

  const { executor: executorAddress } = useExecutorDiscovery();

  // Step 2: after harness is deployed, call configureFundAndStart
  useEffect(() => {
    if (!harnessReceipt || !address || !strategyRef || !executorAddress || !publicClient) return;
    if (status !== "confirming_harness") return;

    if (harnessReceipt.status === "reverted") {
      setStatus("error");
      setError("Harness deployment reverted. Check gas or factory state.");
      return;
    }

    if (harnessReceipt.status === "success") {
      // Extract harness address from logs
      const deployLog = harnessReceipt.logs.find(
        l => l.address.toLowerCase() === SOVEREIGN_FACTORY.toLowerCase()
      );

      let harness: `0x${string}` | undefined;
      if (deployLog && deployLog.topics[3]) {
        // HarnessDeployed event: topics[1]=owner, topics[2]=userSalt, topics[3]=childSalt, data=harness
        // Actually the harness address is in the data field
        try {
          const decoded = decodeAbiParameters(
            [{ type: "address" }],
            deployLog.data as `0x${string}`
          );
          harness = decoded[0] as `0x${string}`;
        } catch {
          // Fallback: predict harness from receipt
        }
      }

      if (!harness) {
        setStatus("error");
        setError("Could not extract harness address from deploy receipt.");
        return;
      }

      setHarnessAddress(harness);
      configureHarness(harness, strategyRef, executorAddress);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [harnessReceipt]);

  // Step 2 effect: persist on config success
  useEffect(() => {
    if (!configReceipt || !address || !strategyRef) return;

    if (configReceipt.status === "reverted") {
      setStatus("error");
      setError("configureFundAndStart reverted. Ensure sufficient scheduler funding.");
      return;
    }

    if (configReceipt.status === "success") {
      const funding = calculateFunding(strategyRef);
      const agentInfo = {
        owner: address,
        harnessAddress,
        deployTxHash: txHash,
        configTxHash,
        strategy: {
          ...strategyRef,
          maxPricePerNFT: strategyRef.maxPricePerNFT.toString(),
          totalBudget: strategyRef.totalBudget.toString(),
          apiKey: "",
        },
        funding: {
          total: funding.total.toString(),
          schedulerFunding: funding.schedulerFunding.toString(),
        },
        deployedAt: Date.now(),
        status: "running",
      };

      const agents = JSON.parse(localStorage.getItem("cauldron_agents") || "[]");
      agents.push(agentInfo);
      localStorage.setItem("cauldron_agents", JSON.stringify(agents));

      setStatus("success");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configReceipt]);

  const configureHarness = async (
    harness: `0x${string}`,
    strategy: AgentStrategy,
    executor: `0x${string}`,
  ) => {
    try {
      setStatus("configuring");

      const params = buildSovereignParams(
        strategy,
        executor,
        harness,
        MARKETPLACE_ADDRESS,
      );
      const schedule = buildScheduleConfig(strategy);
      const rolling = buildRollingConfig(strategy);
      const lockDuration = 0n;

      const funding = calculateFunding(strategy);

      const data = encodeFunctionData({
        abi: SOVEREIGN_HARNESS_ABI,
        functionName: "configureFundAndStart",
        args: [params, schedule, rolling, lockDuration],
      });

      // configureFundAndStart needs >= 3M gas and schedulerFunding as msg.value
      const hash = await sendTransactionAsync({
        to: harness,
        data,
        value: funding.schedulerFunding,
        gas: 4_000_000n,
      });

      setConfigTxHash(hash);
      setStatus("confirming_config");
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Configure failed");
    }
  };

  // Step 1: deploy harness
  const deploy = useCallback(async (strategy: AgentStrategy) => {
    if (!address) {
      setError("Connect wallet first");
      return;
    }

    try {
      setStatus("deploying_harness");
      setError(undefined);
      setStrategyRef(strategy);
      setTxHash(undefined);
      setConfigTxHash(undefined);
      setHarnessAddress(undefined);

      const saltInput = `${address}-${Date.now()}-${strategy.mode}`;
      const userSalt = keccak256(toBytes(saltInput));

      const data = encodeFunctionData({
        abi: SOVEREIGN_FACTORY_ABI,
        functionName: "deployHarness",
        args: [userSalt],
      });

      // deployHarness uses CREATE3 (~400K gas)
      const hash = await sendTransactionAsync({
        to: SOVEREIGN_FACTORY,
        data,
        gas: 1_500_000n,
      });

      setTxHash(hash);
      setStatus("confirming_harness");
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Deploy failed");
    }
  }, [address, sendTransactionAsync]);

  return {
    deploy,
    status,
    txHash: configTxHash || txHash,
    harnessAddress,
    isConfirming,
    isSuccess,
    isFailed,
    error,
    reset: () => {
      setStatus("idle");
      setTxHash(undefined);
      setConfigTxHash(undefined);
      setHarnessAddress(undefined);
      setError(undefined);
      setStrategyRef(null);
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

  useState(() => { refresh(); });

  return { agents, refresh };
}
