'use client';

import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'glass-strong' | 'interactive';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default:
        'bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border',
      glass:
        'bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-xl border border-light-border dark:border-dark-border',
      'glass-strong':
        'bg-light-card/90 dark:bg-dark-card/90 backdrop-blur-2xl border border-light-border/50 dark:border-dark-border/50 shadow-xl shadow-black/5 dark:shadow-black/20',
      interactive:
        'bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border transition-all duration-300 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 hover:-translate-y-0.5',
    };

    return (
      <div
        ref={ref}
        className={cn('rounded-2xl p-6', variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('mb-4', className)} {...props} />
));

CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-lg font-semibold text-gray-900 dark:text-white',
      className
    )}
    {...props}
  />
));

CardTitle.displayName = 'CardTitle';

export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('', className)} {...props} />
));

CardContent.displayName = 'CardContent';
