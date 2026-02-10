'use client';

import { useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface SecretRevealModalProps {
  open: boolean;
  onClose: () => void;
  secret: string;
  onConfirm: () => void;
}

export function SecretRevealModal({ open, onClose, secret, onConfirm }: SecretRevealModalProps) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = secret;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [secret]);

  const handleConfirm = () => {
    onConfirm();
    onClose();
    setConfirmed(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Save Your Secret" className="max-w-lg">
      <div className="space-y-4">
        <div className="p-4 bg-accent-orange/10 border border-accent-orange/20 rounded-xl">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-accent-orange mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-accent-orange">Important</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                This secret is required to complete your swap. If you lose it, your locked funds cannot be recovered. Save it in a secure location.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            HTLC Secret
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 bg-light-hover dark:bg-dark-hover rounded-xl text-xs font-mono text-gray-900 dark:text-white break-all select-all">
              {secret}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              className="flex-shrink-0"
            >
              {copied ? (
                <svg className="w-4 h-4 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </Button>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-accent-blue focus:ring-accent-blue"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            I have saved this secret in a secure location
          </span>
        </label>

        <Button
          variant="primary"
          className="w-full"
          disabled={!confirmed}
          onClick={handleConfirm}
        >
          Continue with Swap
        </Button>
      </div>
    </Modal>
  );
}
