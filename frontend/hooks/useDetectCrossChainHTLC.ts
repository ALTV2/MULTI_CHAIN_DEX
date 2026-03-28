'use client';

import { useState, useEffect } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { HTLC_ABI } from '@/lib/contracts/abis/HTLC';
import { getContractAddress } from '@/lib/contracts/addresses';
import { getPublicClient } from '@/lib/utils/rpcClient';
import { hexToBytes } from '@/lib/utils/crossChainCrypto';
import { useSettingsStore } from '@/stores/useSettingsStore';

export interface DetectedHTLC {
  swapId: `0x${string}`;
  initiator?: `0x${string}`;
  participant?: `0x${string}`;
  token?: `0x${string}`;
  amount: bigint;
  hashlock: `0x${string}`;
  timelock: bigint;
  blockNumber?: bigint;
  // For SUI HTLCs — needed for withdraw/refund
  htlcObjectId?: string;
}

/**
 * Automatically detect if an HTLC was created on the target chain for a cross-chain order.
 *
 * Handles two cases:
 *  1. SUI → EVM: matcher creates EVM HTLC without calling matchOrder on SUI.
 *     Polls EVM SwapCreated events where participant = creator's EVM address.
 *  2. EVM → SUI: matcher creates SUI HTLC after calling matchOrder on EVM.
 *     Polls SUI SwapCreated events where participant = creator's SUI address.
 */
export function useDetectCrossChainHTLC(params: {
  orderId: string;
  sourceChainId: number | string;
  targetChainId: number | string;
  creatorAddress: string;         // EVM address for SUI→EVM; SUI address for EVM→SUI
  creatorSuiAddress?: string;     // Creator's SUI address (needed for EVM→SUI detection)
  enabled?: boolean;
}) {
  const { orderId, sourceChainId, targetChainId, creatorAddress, creatorSuiAddress, enabled = true } = params;

  const suiClient = useSuiClient();
  const autoUpdate = useSettingsStore((s) => s.autoUpdate);
  const [detectedHTLC, setDetectedHTLC] = useState<DetectedHTLC | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Case 1: SUI → EVM (source is SUI, target is EVM)
  const isSuiSource = typeof sourceChainId === 'string' && sourceChainId.includes('sui');
  const isEvmTarget = typeof targetChainId === 'number';
  const shouldDetectEvm = enabled && isSuiSource && isEvmTarget;

  // Case 2: EVM → SUI (source is EVM, target is SUI)
  const isEvmSource = typeof sourceChainId === 'number';
  const isSuiTarget = typeof targetChainId === 'string' && (targetChainId as string).includes('sui');
  const shouldDetectSui = enabled && isEvmSource && isSuiTarget;

  const htlcAddress = shouldDetectEvm
    ? (getContractAddress(targetChainId, 'htlc') as `0x${string}`)
    : undefined;

  const suiPackageId = shouldDetectSui
    ? (getContractAddress(targetChainId, 'htlc') as string)
    : undefined;

  // ── Case 1: Poll EVM SwapCreated events (SUI→EVM) ───────────────────────
  useEffect(() => {
    if (!shouldDetectEvm || !htlcAddress || detectedHTLC || typeof targetChainId !== 'number') return;

    let isMounted = true;

    async function checkForEvmHTLC() {
      if (!htlcAddress || typeof targetChainId !== 'number') return;
      try {
        setIsPolling(true);
        const publicClient = getPublicClient(targetChainId);
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - 10000n;

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
          args: { participant: creatorAddress as `0x${string}` },
          fromBlock,
          toBlock: 'latest',
        });

        if (logs.length > 0 && isMounted) {
          const latestLog = logs[logs.length - 1];
          const { swapId, initiator, participant, token, amount, hashlock, timelock } = latestLog.args as any;
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
        console.error('[HTLC Detector EVM] Error:', error);
      } finally {
        if (isMounted) setIsPolling(false);
      }
    }

    checkForEvmHTLC();
    if (!autoUpdate) return () => { isMounted = false; };
    const interval = setInterval(checkForEvmHTLC, 30000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [shouldDetectEvm, htlcAddress, creatorAddress, targetChainId, detectedHTLC, autoUpdate]);

  // ── Case 2: Poll SUI SwapCreated events (EVM→SUI) ───────────────────────
  useEffect(() => {
    if (!shouldDetectSui || !suiPackageId || detectedHTLC) return;
    let participantAddr = creatorSuiAddress || creatorAddress;
    if (!participantAddr) return;
    // Ensure SUI address is 32-byte format (pad EVM 20-byte addresses)
    const rawHex = participantAddr.replace('0x', '');
    if (rawHex.length < 64) {
      participantAddr = `0x${rawHex.padStart(64, '0')}`;
    }

    let isMounted = true;

    async function checkForSuiHTLC() {
      if (!suiPackageId) return;
      try {
        setIsPolling(true);

        const result = await suiClient.queryEvents({
          query: { MoveEventType: `${suiPackageId}::htlc::SwapCreated` },
          order: 'descending',
          limit: 50,
        });

        for (const event of result.data) {
          if (!event.parsedJson || typeof event.parsedJson !== 'object') continue;
          const parsed = event.parsedJson as any;

          // Match participant address (SUI addresses are lowercase hex)
          const evtParticipant = (parsed.participant as string || '').toLowerCase();
          const targetParticipant = participantAddr.toLowerCase();
          if (evtParticipant !== targetParticipant) continue;

          // Convert byte arrays to hex strings
          const swapIdHex = `0x${(parsed.swap_id as number[]).map((b) => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
          const hashlockHex = `0x${(parsed.hashlock as number[]).map((b) => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

          if (isMounted) {
            setDetectedHTLC({
              swapId: swapIdHex,
              hashlock: hashlockHex,
              timelock: BigInt(parsed.timelock || 0),
              amount: BigInt(parsed.amount || 0),
              htlcObjectId: parsed.swap_object_id as string,
            });
          }
          break;
        }
      } catch (error) {
        console.error('[HTLC Detector SUI] Error:', error);
      } finally {
        if (isMounted) setIsPolling(false);
      }
    }

    checkForSuiHTLC();
    if (!autoUpdate) return () => { isMounted = false; };
    const interval = setInterval(checkForSuiHTLC, 30000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [shouldDetectSui, suiPackageId, creatorAddress, creatorSuiAddress, detectedHTLC, suiClient, autoUpdate]);

  return {
    detectedHTLC,
    isDetecting: (shouldDetectEvm || shouldDetectSui) && isPolling,
  };
}
