'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, rightElement, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            type={type}
            ref={ref}
            className={cn(
              'w-full px-4 py-3 rounded-xl',
              'bg-light-hover dark:bg-dark-hover',
              'border border-light-border dark:border-dark-border',
              'text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent',
              'transition-all duration-200',
              error && 'border-accent-red focus:ring-accent-red',
              rightElement && 'pr-20',
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-accent-red">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
