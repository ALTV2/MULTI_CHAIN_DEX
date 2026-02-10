'use client';

import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', dot, ...props }, ref) => {
    const variants = {
      default: 'bg-gray-500/20 text-gray-400',
      success: 'bg-accent-green/20 text-accent-green',
      warning: 'bg-accent-orange/20 text-accent-orange',
      error: 'bg-accent-red/20 text-accent-red',
      info: 'bg-accent-blue/20 text-accent-blue',
      outline: 'bg-transparent border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
          variants[variant],
          className
        )}
        {...props}
      >
        {dot && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
          </span>
        )}
        {props.children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
