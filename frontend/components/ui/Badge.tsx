'use client';

import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-gray-500/20 text-gray-400',
      success: 'bg-accent-green/20 text-accent-green',
      warning: 'bg-accent-orange/20 text-accent-orange',
      error: 'bg-accent-red/20 text-accent-red',
      info: 'bg-accent-blue/20 text-accent-blue',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';
