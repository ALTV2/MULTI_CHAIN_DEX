'use client';

import { useState, useEffect } from 'react';
import { HTLC_ABI } from '@/lib/contracts/abis/HTLC';
import { getContractAddress } from '@/lib/contracts/addresses';
import { getPublicClient } from '@/lib/utils/rpcClient';

export interface DetectedHTLC {
  swapId: `0x${string}`;
  initiator: `0x${string}`;
  participant: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  hashlock: `0x${string}`;
  timelock: bigint;
  blockNumber: bigint;
}

/**
 * Automatically detect if an HTLC was created on the target chain for a cross-chain order
 * Used for SUI → EVM orders where matcher creates HTLC on EVM without calling matchOrder on SUI
 *
 * Strategy: Poll for SwapCreated events where participant = order creator
 */
export function useDetectCrossChainHTLC(params: {
  orderId: string;
  sourceChainId: number | string;
  targetChainId: number | string;
  creatorAddress: string;
  enabled?: boolean;
}) {
  const { orderId, sourceChainId, targetChainId, creatorAddress, enabled = true } = params;

  const [detectedHTLC, setDetectedHTLC] = useState<DetectedHTLC | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Only works for SUI → EVM (source is SUI, target is EVM number)
  const isSuiSource = typeof sourceChainId === 'string' && sourceChainId.includes('sui');
  const isEvmTarget = typeof targetChainId === 'number';
  const shouldDetect = enabled && isSuiSource && isEvmTarget;

  const htlcAddress = shouldDetect
    ? (getContractAddress(targetChainId, 'htlc') as `0x${string}`)
    : undefined;

  // Poll for SwapCreated events
  useEffect(() => {
    if (!shouldDetect || !htlcAddress || detectedHTLC || typeof targetChainId !== 'number') return;

    let isMounted = true;

    async function checkForHTLC() {
      if (!htlcAddress || typeof targetChainId !== 'number') return;

      try {
        setIsPolling(true);
        console.log('🔍 [HTLC Detector] Checking for cross-chain HTLC...', {
          orderId,
          creatorAddress,
          targetChainId,
          htlcAddress,
        });

        // Get publicClient for the target chain (independent of wallet connection)
        const publicClient = getPublicClient(targetChainId);

        // Get current block number
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - 1000n; // Check last ~1000 blocks (~3-4 hours on Sepolia)

        // Query SwapCreated events
        // event SwapCreated(bytes32 indexed swapId, address indexed initiator, address indexed participant, ...)
        const logs = await publicClient.getLogs({
          address: htlcAddress,
          event: {
            type: 'event',
            name: 'SwapCreated',
            inputs: [
              { type: 'bytes32', indexed: true, name: 'swapId' },
              { type: 'address', indexed: true, name: 'initiator' },
              { type: 'address', indexed: true, name: 'participant' },
              { type: 'address', indexed: false, name: 'token' },
              { type: 'uint256', indexed: false, name: 'amount' },
              { type: 'bytes32', indexed: false, name: 'hashlock' },
              { type: 'uint256', indexed: false, name: 'timelock' },
            ],
          },
          args: {
            participant: creatorAddress as `0x${string}`, // Filter by participant = creator
          },
          fromBlock,
          toBlock: 'latest',
        });

        console.log('📊 [HTLC Detector] Found events:', logs.length);

        if (logs.length > 0 && isMounted) {
          // Take the most recent event
          const latestLog = logs[logs.length - 1];
          const { swapId, initiator, participant, token, amount, hashlock, timelock } = latestLog.args as any;

          console.log('✅ [HTLC Detector] Detected HTLC!', {
            swapId,
            initiator,
            participant,
            token,
            amount: amount?.toString(),
            hashlock,
            timelock: timelock?.toString(),
            blockNumber: latestLog.blockNumber,
          });

          setDetectedHTLC({
            swapId: swapId as `0x${string}`,
            initiator: initiator as `0x${string}`,
            participant: participant as `0x${string}`,
            token: token as `0x${string}`,
            amount: amount as bigint,
            hashlock: hashlock as `0x${string}`,
            timelock: timelock as bigint,
            blockNumber: latestLog.blockNumber,
          });
        }
      } catch (error) {
        console.error('❌ [HTLC Detector] Error checking for HTLC:', error);
      } finally {
        setIsPolling(false);
      }
    }

    // Initial check
    checkForHTLC();

    // Poll every 15 seconds
    const interval = setInterval(checkForHTLC, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [shouldDetect, htlcAddress, creatorAddress, orderId, targetChainId, detectedHTLC]);

  return {
    detectedHTLC,
    isDetecting: shouldDetect && isPolling,
  };
}
