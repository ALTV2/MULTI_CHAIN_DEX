'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { chainConfig, SupportedChainId, getExplorerTxUrl } from '@/lib/contracts/addresses';

export type SwapStep =
  | 'create_order'
  | 'htlc_source'
  | 'htlc_target'
  | 'withdraw_source'
  | 'withdraw_target'
  | 'completed';

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

interface SwapProgressProps {
  currentStep: SwapStep;
  sourceChainId: number;
  targetChainId: number;
  sourceTxHash?: string;
  targetTxHash?: string;
  error?: string;
}

const STEP_CONFIG: Record<SwapStep, { index: number; label: string; description: string }> = {
  create_order: {
    index: 0,
    label: 'Create Order',
    description: 'Creating cross-chain order on source chain',
  },
  htlc_source: {
    index: 1,
    label: 'Lock on Source',
    description: 'Locking funds in HTLC on source chain',
  },
  htlc_target: {
    index: 2,
    label: 'Lock on Target',
    description: 'Counterparty locks funds on target chain',
  },
  withdraw_source: {
    index: 3,
    label: 'Claim on Target',
    description: 'Revealing secret to claim funds',
  },
  withdraw_target: {
    index: 4,
    label: 'Claim on Source',
    description: 'Counterparty claims funds with revealed secret',
  },
  completed: {
    index: 5,
    label: 'Completed',
    description: 'Swap completed successfully',
  },
};

export function SwapProgress({
  currentStep,
  sourceChainId,
  targetChainId,
  sourceTxHash,
  targetTxHash,
  error,
}: SwapProgressProps) {
  const sourceConfig = chainConfig[sourceChainId as SupportedChainId];
  const targetConfig = chainConfig[targetChainId as SupportedChainId];

  const currentStepIndex = STEP_CONFIG[currentStep].index;

  const steps = useMemo(() => [
    {
      key: 'create_order',
      label: 'Create Order',
      description: `Post order on ${sourceConfig?.shortName}`,
      chainId: sourceChainId,
    },
    {
      key: 'htlc_source',
      label: `Lock on ${sourceConfig?.shortName}`,
      description: 'Lock funds in HTLC contract',
      chainId: sourceChainId,
      txHash: sourceTxHash,
    },
    {
      key: 'htlc_target',
      label: `Lock on ${targetConfig?.shortName}`,
      description: 'Counterparty locks matching funds',
      chainId: targetChainId,
      txHash: targetTxHash,
    },
    {
      key: 'withdraw_source',
      label: `Claim on ${targetConfig?.shortName}`,
      description: 'Reveal secret to claim funds',
      chainId: targetChainId,
    },
    {
      key: 'withdraw_target',
      label: `Claim on ${sourceConfig?.shortName}`,
      description: 'Counterparty uses secret to claim',
      chainId: sourceChainId,
    },
  ], [sourceConfig, targetConfig, sourceChainId, targetChainId, sourceTxHash, targetTxHash]);

  const getStepStatus = (stepIndex: number): StepStatus => {
    if (error && stepIndex === currentStepIndex) return 'failed';
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'in_progress';
    return 'pending';
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Swap Progress</h3>
        {currentStep === 'completed' ? (
          <Badge variant="success">Completed</Badge>
        ) : error ? (
          <Badge variant="error">Failed</Badge>
        ) : (
          <Badge variant="warning">In Progress</Badge>
        )}
      </div>

      {/* Chain Indicators */}
      <div className="flex items-center justify-center gap-4 mb-6 p-3 rounded-lg bg-gray-800/50">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: sourceConfig?.color }}
          />
          <span className="text-sm">{sourceConfig?.shortName}</span>
        </div>
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: targetConfig?.color }}
          />
          <span className="text-sm">{targetConfig?.shortName}</span>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gray-700" />
        <div
          className="absolute left-[15px] top-0 w-0.5 bg-green-500 transition-all duration-500"
          style={{ height: `${Math.min(100, (currentStepIndex / (steps.length - 1)) * 100)}%` }}
        />

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step, index) => {
            const status = getStepStatus(index);
            const config = chainConfig[step.chainId as SupportedChainId];

            return (
              <div key={step.key} className="flex gap-4 relative">
                {/* Step Indicator */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                    status === 'completed'
                      ? 'bg-green-500 text-white'
                      : status === 'in_progress'
                      ? 'bg-blue-500 text-white animate-pulse'
                      : status === 'failed'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {status === 'completed' ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : status === 'failed' ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <span className="text-sm">{index + 1}</span>
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-medium ${status === 'pending' ? 'text-gray-500' : ''}`}>
                      {step.label}
                    </span>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: config?.color }}
                    />
                  </div>
                  <p className="text-sm text-gray-400">{step.description}</p>

                  {step.txHash && (
                    <a
                      href={getExplorerTxUrl(step.chainId, step.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block"
                    >
                      View Transaction
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </Card>
  );
}
