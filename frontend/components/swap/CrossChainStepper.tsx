'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { SwapPhase } from '@/types/swap';

// ─── Step definitions ────────────────────────────────────────────────────────

interface StepDef {
  id: string;
  shortLabel: string;
  fullLabel: string;
  actor: 'creator' | 'matcher' | 'both';
  // Descriptions from each role's point of view
  creatorDesc: string;
  matcherDesc: string;
}

const SUI_TO_EVM_STEPS: StepDef[] = [
  {
    id: 'open',
    shortLabel: 'Open',
    fullLabel: 'Order Created',
    actor: 'creator',
    creatorDesc: 'You posted a sell order on SUI with your desired price. It is now visible to all potential counterparties.',
    matcherDesc: 'The order creator posted a sell order on SUI with their desired price.',
  },
  {
    id: 'matching',
    shortLabel: 'Matching',
    fullLabel: 'Waiting for Match',
    actor: 'matcher',
    creatorDesc: 'Waiting for a counterparty (matcher) to find and accept your order.',
    matcherDesc: 'You found the order and are about to match it.',
  },
  {
    id: 'evm_lock',
    shortLabel: 'EVM Lock',
    fullLabel: 'Counterparty Locks EVM',
    actor: 'matcher',
    creatorDesc: 'Counterparty locks EVM tokens in an HTLC contract with a secret hashlock. This happens automatically when they click "Match Order". You do NOT need to do anything on Ethereum here.',
    matcherDesc: 'You lock EVM tokens in an HTLC contract with a secret hashlock. This is done in a single step as part of matching the order.',
  },
  {
    id: 'sui_lock',
    shortLabel: 'SUI Lock',
    fullLabel: 'You Lock SUI',
    actor: 'creator',
    creatorDesc: 'You verify the counterparty\'s EVM HTLC and lock your SUI tokens in a counter-HTLC using the same hashlock. This commits you to the trade.',
    matcherDesc: 'The order creator verifies your EVM HTLC and locks their SUI tokens in a counter-HTLC using the same hashlock.',
  },
  {
    id: 'reveal',
    shortLabel: 'Reveal',
    fullLabel: 'Secret Revealed',
    actor: 'matcher',
    creatorDesc: 'Counterparty withdraws from your SUI HTLC using their secret. The secret is published on-chain and becomes visible to you.',
    matcherDesc: 'You withdraw from the creator\'s SUI HTLC using your secret. The secret is published on-chain, allowing the creator to claim EVM tokens.',
  },
  {
    id: 'claim_evm',
    shortLabel: 'Claim',
    fullLabel: 'You Claim EVM Tokens',
    actor: 'creator',
    creatorDesc: 'You use the revealed secret to withdraw from the counterparty\'s EVM HTLC and receive your EVM tokens.',
    matcherDesc: 'The creator uses the revealed secret to claim EVM tokens from your HTLC. Trade is almost complete.',
  },
  {
    id: 'done',
    shortLabel: 'Done',
    fullLabel: 'Completed',
    actor: 'both',
    creatorDesc: 'Trade complete! You received EVM tokens, counterparty received SUI tokens.',
    matcherDesc: 'Trade complete! You received SUI tokens, the creator received EVM tokens.',
  },
];

const EVM_TO_SUI_STEPS: StepDef[] = [
  {
    id: 'open',
    shortLabel: 'Open',
    fullLabel: 'Order Created',
    actor: 'creator',
    creatorDesc: 'You posted a sell order on EVM with your desired price. It is now visible to all potential counterparties.',
    matcherDesc: 'The order creator posted a sell order on EVM with their desired price.',
  },
  {
    id: 'matching',
    shortLabel: 'Matching',
    fullLabel: 'Waiting for Match',
    actor: 'matcher',
    creatorDesc: 'Waiting for a counterparty (matcher) to find and accept your order.',
    matcherDesc: 'You found the order and are about to match it.',
  },
  {
    id: 'evm_lock',
    shortLabel: 'EVM Lock',
    fullLabel: 'You Lock EVM',
    actor: 'creator',
    creatorDesc: 'You lock your EVM tokens in an HTLC contract with a secret hashlock. This initiates the atomic swap.',
    matcherDesc: 'The order creator locks EVM tokens in an HTLC with a secret hashlock.',
  },
  {
    id: 'sui_lock',
    shortLabel: 'SUI Lock',
    fullLabel: 'Counterparty Locks SUI',
    actor: 'matcher',
    creatorDesc: 'Counterparty locks SUI tokens in an HTLC using the same hashlock as your EVM HTLC. This confirms they are participating.',
    matcherDesc: 'You lock SUI tokens in an HTLC using the same hashlock as the creator\'s EVM HTLC.',
  },
  {
    id: 'claim_sui',
    shortLabel: 'Claim SUI',
    fullLabel: 'You Claim SUI',
    actor: 'creator',
    creatorDesc: 'You use your own secret to withdraw from the counterparty\'s SUI HTLC. The secret is published on-chain as part of the withdrawal.',
    matcherDesc: 'The creator uses their secret to claim SUI tokens from your HTLC. The secret is now published on-chain.',
  },
  {
    id: 'cp_claims',
    shortLabel: 'CP Claim',
    fullLabel: 'Counterparty Claims EVM',
    actor: 'matcher',
    creatorDesc: 'Counterparty uses the revealed secret to claim EVM tokens from your HTLC. Trade is almost complete.',
    matcherDesc: 'You use the revealed secret to claim EVM tokens from the creator\'s HTLC and complete the trade.',
  },
  {
    id: 'done',
    shortLabel: 'Done',
    fullLabel: 'Completed',
    actor: 'both',
    creatorDesc: 'Trade complete! You received SUI tokens, counterparty received EVM tokens.',
    matcherDesc: 'Trade complete! You received EVM tokens, the creator received SUI tokens.',
  },
];

// ─── Phase → step index ──────────────────────────────────────────────────────

/** Returns the index of the CURRENT (next-to-do) step. Steps before it are completed. */
function getSuiToEvmStepIndex(phase: SwapPhase): number {
  switch (phase) {
    case 'order_created':       return 1;  // step 0 done, waiting for match
    case 'order_matched':       return 3;  // steps 0-2 done (created, matched, evm_lock), sui_lock current
    case 'creator_htlc_created':return 3;  // same — shouldn't normally happen in SUI→EVM
    case 'matcher_htlc_created':return 4;  // steps 0-3 done, waiting for reveal
    case 'secret_revealed':     return 5;  // steps 0-4 done, claim_evm current
    case 'completed':           return 7;  // all done
    default:                    return 0;
  }
}

function getEvmToSuiStepIndex(phase: SwapPhase): number {
  switch (phase) {
    case 'order_created':       return 1;  // waiting for match
    case 'order_matched':       return 2;  // matched, evm_lock current
    case 'creator_htlc_created':return 3;  // evm locked, sui_lock current (waiting for matcher)
    case 'matcher_htlc_created':return 4;  // both locked, claim_sui current
    case 'secret_revealed':     return 5;  // sui claimed, cp_claims current
    case 'completed':           return 7;  // all done
    default:                    return 0;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface CrossChainStepperProps {
  phase: SwapPhase;
  isSuiToEvm: boolean;
  role: 'creator' | 'matcher';
}

export function CrossChainStepper({ phase, isSuiToEvm, role }: CrossChainStepperProps) {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  const steps = isSuiToEvm ? SUI_TO_EVM_STEPS : EVM_TO_SUI_STEPS;
  const currentStepIndex = isSuiToEvm
    ? getSuiToEvmStepIndex(phase)
    : getEvmToSuiStepIndex(phase);

  const isRefund = phase === 'refundable' || phase === 'refunded';
  const allDone = currentStepIndex >= steps.length;

  if (isRefund) {
    return (
      <div className="flex items-center gap-2 py-3">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20 text-red-400 text-sm">✕</div>
        <span className="text-sm text-red-400 font-medium">
          {phase === 'refundable' ? 'Expired — Refund Available' : 'Refunded'}
        </span>
      </div>
    );
  }

  const hoveredDef = hoveredStep !== null ? steps[hoveredStep] : null;
  const isYourStep = (step: StepDef) => step.actor === role || step.actor === 'both';

  return (
    <div className="py-2">

      {/* ── Stepper row ── */}
      <div className="flex items-start w-full">
        {steps.map((step, idx) => {
          const isCompleted = allDone || idx < currentStepIndex;
          const isCurrent   = !allDone && idx === currentStepIndex;
          const isYou       = isYourStep(step);
          const isActive    = isCompleted || isCurrent;

          return (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              {/* Step node */}
              <div
                className="flex flex-col items-center flex-shrink-0 cursor-help select-none"
                style={{ minWidth: 40 }}
                onMouseEnter={() => setHoveredStep(idx)}
                onMouseLeave={() => setHoveredStep(null)}
              >
                {/* Circle */}
                <div
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200',
                    isCompleted && 'bg-green-500 text-white shadow-sm shadow-green-500/30',
                    isCurrent && isYou  && 'bg-blue-500 text-white ring-4 ring-blue-500/20 shadow-sm shadow-blue-500/40',
                    isCurrent && !isYou && 'bg-amber-500/80 text-white ring-4 ring-amber-500/20',
                    !isActive && 'bg-gray-700 text-gray-500',
                    hoveredStep === idx && 'scale-110',
                  )}
                >
                  {isCompleted ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCurrent ? (
                    <span className={cn(isYou ? 'animate-pulse' : 'animate-spin-slow')}>
                      {isYou ? '→' : '⟳'}
                    </span>
                  ) : (
                    idx + 1
                  )}
                </div>

                {/* Short label */}
                <span
                  className={cn(
                    'text-[9px] mt-1 text-center leading-tight whitespace-nowrap',
                    isCompleted && 'text-green-400',
                    isCurrent && isYou  && 'text-blue-400 font-semibold',
                    isCurrent && !isYou && 'text-amber-400 font-semibold',
                    !isActive && 'text-gray-600',
                  )}
                >
                  {step.shortLabel}
                </span>

                {/* Actor dot */}
                <div
                  className={cn(
                    'w-1 h-1 rounded-full mt-0.5',
                    isYou
                      ? isCompleted ? 'bg-blue-400' : isCurrent ? 'bg-blue-500' : 'bg-gray-600'
                      : isCompleted ? 'bg-amber-400/70' : isCurrent ? 'bg-amber-500' : 'bg-gray-700',
                  )}
                />
              </div>

              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-px mx-0.5',
                    // Shift connector up to circle center (circle=28px, label~14px, dot~4px → total~46px, circle at top → center at 14px)
                    '-mt-6',
                    isCompleted ? 'bg-green-500' : 'bg-gray-700',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 mt-1 mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span className="text-[10px] text-gray-500">Your action</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400/70" />
          <span className="text-[10px] text-gray-500">Counterparty</span>
        </div>
        <span className="text-[10px] text-gray-600 ml-auto">Hover step for details</span>
      </div>

      {/* ── Tooltip info box ── */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-150',
          hoveredDef ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        {hoveredDef && (
          <div className="px-3 py-2.5 rounded-xl bg-gray-800/70 border border-gray-700/60">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">{hoveredDef.fullLabel}</p>
                <p className="text-[11px] text-gray-300 mt-0.5 leading-relaxed">
                  {role === 'creator' ? hoveredDef.creatorDesc : hoveredDef.matcherDesc}
                </p>
              </div>
              <span
                className={cn(
                  'flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full',
                  isYourStep(hoveredDef)
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : hoveredDef.actor === 'both'
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
                )}
              >
                {hoveredDef.actor === 'both' ? 'Both' : isYourStep(hoveredDef) ? 'You' : 'Counterparty'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
