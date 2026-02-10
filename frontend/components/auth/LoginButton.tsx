'use client';

import { useLogin } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';

export function LoginButton() {
  const { signIn, isLoading, error } = useLogin();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={signIn}
        loading={isLoading}
        className="text-gray-600 dark:text-gray-300 hover:text-accent-blue dark:hover:text-accent-blue"
      >
        <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        Sign In
      </Button>
      {error && (
        <span className="text-xs text-accent-red">{error}</span>
      )}
    </div>
  );
}
