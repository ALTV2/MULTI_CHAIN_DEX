'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { SwapPhase } from '@/types/swap';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SwapType = 'evm_to_evm' | 'evm_to_sui' | 'sui_to_evm';

interface StepDef {
  phase: SwapPhase;
  shortLabel: string;
  fullLabel: string;
  actor: 'creator' | 'matcher' | 'both';
  creatorDesc: string;
  matcherDesc: string;
}

// ─── Unified 6-step sequences ─────────────────────────────────────────────────
//
// All swap types share the same 6-step happy path:
//   Created → Matched → Lock 1 → Lock 2 → Claim → Done
//
// Refund is NOT a step — it is rendered as a separate status section.

const EVM_TO_EVM_STEPS: StepDef[] = [
  {
    phase: 'order_created',
    shortLabel: 'Created',
    fullLabel: 'Order Created',
    actor: 'creator',
    creatorDesc: 'You placed an order on the order book. No funds are locked yet.',
    matcherDesc: 'The initiator placed an order on the order book.',
  },
  {
    phase: 'order_matched',
    shortLabel: 'Matched',
    fullLabel: 'Order Matched',
    actor: 'matcher',
    creatorDesc: 'A counterparty reserved the right to fill your order.',
    matcherDesc: 'You reserved the right to fill the order.',
  },
  {
    phase: 'creator_htlc_created',
    shortLabel: 'Lock 1',
    fullLabel: 'Initiator Locks',
    actor: 'creator',
    creatorDesc: 'You lock your tokens in an HTLC with a timelock T₁ and a secret hash only you hold.',
    matcherDesc: 'The initiator locked their tokens in an HTLC. Verify and lock yours.',
  },
  {
    phase: 'matcher_htlc_created',
    shortLabel: 'Lock 2',
    fullLabel: 'Counterparty Locks',
    actor: 'matcher',
    creatorDesc: 'The counterparty locked their tokens with the same hash and a shorter timelock T₂.',
    matcherDesc: 'You lock your tokens in a counter-HTLC using the same hash and timelock T₂ < T₁.',
  },
  {
    phase: 'secret_revealed',
    shortLabel: 'Claim',
    fullLabel: 'Tokens Claimed',
    actor: 'creator',
    creatorDesc: 'You reveal the secret to claim the counterparty\'s tokens. The secret is now public on-chain.',
    matcherDesc: 'The initiator revealed the secret. Use it to claim their locked tokens.',
  },
  {
    phase: 'completed',
    shortLabel: 'Done',
    fullLabel: 'Completed',
    actor: 'both',
    creatorDesc: 'Swap complete! Both parties have received their tokens.',
    matcherDesc: 'Swap complete! Both parties have received their tokens.',
  },
];

const EVM_TO_SUI_STEPS: StepDef[] = [
  {
    phase: 'order_created',
    shortLabel: 'Created',
    fullLabel: 'Order Created',
    actor: 'creator',
    creatorDesc: 'You placed a sell order on EVM. No funds are locked yet.',
    matcherDesc: 'The initiator placed a sell order on EVM.',
  },
  {
    phase: 'order_matched',
    shortLabel: 'Matched',
    fullLabel: 'Order Matched',
    actor: 'matcher',
    creatorDesc: 'A SUI-side counterparty reserved the right to fill your order.',
    matcherDesc: 'You reserved the right to fill the EVM order from the SUI side.',
  },
  {
    phase: 'creator_htlc_created',
    shortLabel: 'Lock 1',
    fullLabel: 'Initiator Locks EVM',
    actor: 'creator',
    creatorDesc: 'You lock your EVM tokens in an HTLC with timelock T₁ and a secret hash.',
    matcherDesc: 'The initiator locked their EVM tokens. Verify and lock your SUI tokens.',
  },
  {
    phase: 'matcher_htlc_created',
    shortLabel: 'Lock 2',
    fullLabel: 'Counterparty Locks SUI',
    actor: 'matcher',
    creatorDesc: 'The counterparty locked SUI tokens with the same hash and a shorter timelock T₂.',
    matcherDesc: 'You lock SUI tokens in a counter-HTLC using the same hash and timelock T₂ < T₁.',
  },
  {
    phase: 'secret_revealed',
    shortLabel: 'Claim',
    fullLabel: 'Tokens Claimed',
    actor: 'creator',
    creatorDesc: 'You reveal the secret to claim SUI tokens. The secret becomes public on-chain.',
    matcherDesc: 'The initiator revealed the secret. Use it to claim their EVM tokens.',
  },
  {
    phase: 'completed',
    shortLabel: 'Done',
    fullLabel: 'Completed',
    actor: 'both',
    creatorDesc: 'Swap complete! You received SUI tokens; the counterparty received EVM tokens.',
    matcherDesc: 'Swap complete! You received EVM tokens; the initiator received SUI tokens.',
  },
];

const SUI_TO_EVM_STEPS: StepDef[] = [
  {
    phase: 'order_created',
    shortLabel: 'Created',
    fullLabel: 'Order Created',
    actor: 'creator',
    creatorDesc: 'You placed a sell order on SUI. No funds are locked yet.',
    matcherDesc: 'The initiator placed a sell order on SUI.',
  },
  {
    phase: 'order_matched',
    shortLabel: 'Matched',
    fullLabel: 'Order Matched',
    actor: 'matcher',
    creatorDesc: 'An EVM-side counterparty reserved the right to fill your order.',
    matcherDesc: 'You reserved the right to fill the SUI order from the EVM side.',
  },
  {
    phase: 'creator_htlc_created',
    shortLabel: 'Lock 1',
    fullLabel: 'Initiator Locks SUI',
    actor: 'creator',
    creatorDesc: 'You lock your SUI tokens in an HTLC with timelock T₁ and a secret hash.',
    matcherDesc: 'The initiator locked their SUI tokens. Verify and lock your EVM tokens.',
  },
  {
    phase: 'matcher_htlc_created',
    shortLabel: 'Lock 2',
    fullLabel: 'Counterparty Locks EVM',
    actor: 'matcher',
    creatorDesc: 'The counterparty locked EVM tokens with the same hash and a shorter timelock T₂.',
    matcherDesc: 'You lock EVM tokens in a counter-HTLC using the same hash and timelock T₂ < T₁.',
  },
  {
    phase: 'secret_revealed',
    shortLabel: 'Claim',
    fullLabel: 'Tokens Claimed',
    actor: 'creator',
    creatorDesc: 'You reveal the secret to claim EVM tokens. The secret becomes public on-chain.',
    matcherDesc: 'The initiator revealed the secret. Use it to claim their SUI tokens.',
  },
  {
    phase: 'completed',
    shortLabel: 'Done',
    fullLabel: 'Completed',
    actor: 'both',
    creatorDesc: 'Swap complete! You received EVM tokens; the counterparty received SUI tokens.',
    matcherDesc: 'Swap complete! You received SUI tokens; the initiator received EVM tokens.',
  },
];

// ─── Phase → step state ───────────────────────────────────────────────────────

type StepState = 'done' | 'current' | 'upcoming';

const HAPPY_ORDER: SwapPhase[] = [
  'order_created',
  'order_matched',
  'creator_htlc_created',
  'matcher_htlc_created',
  'secret_revealed',
  'completed',
];

function lastPhaseFromHtlcs(creatorHtlc?: string, matcherHtlc?: string): SwapPhase {
  if (matcherHtlc) return 'matcher_htlc_created';
  if (creatorHtlc) return 'creator_htlc_created';
  return 'order_matched';
}

function stepState(step: StepDef, phase: SwapPhase, creatorHtlcStatus?: string, matcherHtlcStatus?: string): StepState {
  const onRefundBranch = phase === 'refundable' || phase === 'refunded';

  if (onRefundBranch) {
    const lastPhase = lastPhaseFromHtlcs(creatorHtlcStatus, matcherHtlcStatus);
    const lastIdx = HAPPY_ORDER.indexOf(lastPhase);
    const selfIdx = HAPPY_ORDER.indexOf(step.phase);
    return selfIdx <= lastIdx ? 'done' : 'upcoming';
  }

  if (phase === 'completed') return 'done';

  // Each step represents "transition into this phase" — i.e. a finished event.
  // The current phase corresponds to a transition that already completed, so all
  // steps up to and INCLUDING it are 'done'. The NEXT step is 'current' (the
  // pending action that needs to happen next).
  const current = HAPPY_ORDER.indexOf(phase);
  const self = HAPPY_ORDER.indexOf(step.phase);
  if (self <= current) return 'done';
  if (self === current + 1) return 'current';
  return 'upcoming';
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CrossChainStepperProps {
  phase: SwapPhase;
  swapType: SwapType;
  role: 'creator' | 'matcher';
  creatorHtlcStatus?: string;
  matcherHtlcStatus?: string;
}

export function CrossChainStepper({ phase, swapType, role, creatorHtlcStatus, matcherHtlcStatus }: CrossChainStepperProps) {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  const steps =
    swapType === 'evm_to_sui' ? EVM_TO_SUI_STEPS
    : swapType === 'sui_to_evm' ? SUI_TO_EVM_STEPS
    : EVM_TO_EVM_STEPS;

  const isRefundBranch = phase === 'refundable' || phase === 'refunded';
  const hoveredDef = hoveredStep !== null ? steps[hoveredStep] : null;
  const isYourStep = (step: StepDef) => step.actor === role || step.actor === 'both';

  return (
    <div className="py-2">

      {/* ── Stepper row ── */}
      <div className="flex items-start w-full">
        {steps.map((step, idx) => {
          const state = stepState(step, phase, creatorHtlcStatus, matcherHtlcStatus);
          const isCompleted = state === 'done';
          const isCurrent = state === 'current';
          const isYou = isYourStep(step);
          const isActive = isCompleted || isCurrent;

          return (
            <div key={step.phase} className="flex items-center flex-1 min-w-0">
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
                    isCurrent && isYou && 'bg-blue-500 text-white ring-4 ring-blue-500/20 shadow-sm shadow-blue-500/40',
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
                    <span className={cn(isYou ? 'animate-pulse' : '')}>
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
                    isCurrent && isYou && 'text-blue-400 font-semibold',
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
                    'flex-1 h-px mx-0.5 -mt-6',
                    isCompleted ? 'bg-green-500' : 'bg-gray-700',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Refund indicator (replaces refund steps) ── */}
      {isRefundBranch && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs text-red-400 font-medium">
            {phase === 'refundable' ? 'Timelock expired — refund available' : 'Swap refunded'}
          </span>
        </div>
      )}

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
