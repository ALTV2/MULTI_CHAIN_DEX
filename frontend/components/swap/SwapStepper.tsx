'use client';

import { cn } from '@/lib/utils/cn';
import type { SwapPhase } from '@/types/swap';
import { getPhaseStepIndex } from '@/lib/utils/swapPhase';

const STEPS = [
  { label: 'Open' },
  { label: 'Matched' },
  { label: 'Lock 1' },
  { label: 'Lock 2' },
  { label: 'Claiming' },
  { label: 'Done' },
];

const SAME_CHAIN_STEPS = [
  { label: 'Open' },
  { label: 'Completed' },
];

export function SwapStepper({ phase, isSameChain = false }: { phase: SwapPhase; isSameChain?: boolean }) {
  const currentStep = getPhaseStepIndex(phase);
  const isRefund = phase === 'refundable' || phase === 'refunded';

  // For same-chain orders, use simplified steps
  const steps = isSameChain ? SAME_CHAIN_STEPS : STEPS;
  const currentStepIndex = isSameChain
    ? (phase === 'completed' ? 1 : 0)
    : currentStep;

  if (isRefund) {
    return (
      <div className="flex items-center gap-2 py-3">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20 text-red-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span className="text-sm text-red-400 font-medium">
          {phase === 'refundable' ? 'Expired — Refund Available' : 'Refunded'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center w-full py-3 overflow-x-auto">
      {steps.map((step, idx) => {
        const isCompleted = idx < currentStepIndex;
        const isCurrent = idx === currentStepIndex;
        const isFuture = idx > currentStepIndex;

        return (
          <div key={step.label} className="flex items-center flex-1 min-w-0">
            {/* Step circle */}
            <div className="flex flex-col items-center min-w-[40px]">
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  isCompleted && 'bg-green-500 text-white',
                  isCurrent && 'bg-blue-500 text-white ring-2 ring-blue-500/30',
                  isFuture && 'bg-gray-700 text-gray-500'
                )}
              >
                {isCompleted ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] mt-1 text-center whitespace-nowrap',
                  isCompleted && 'text-green-400',
                  isCurrent && 'text-blue-400 font-medium',
                  isFuture && 'text-gray-600'
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-1',
                  idx < currentStepIndex ? 'bg-green-500' : 'bg-gray-700'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
