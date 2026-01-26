'use client';

import { cn } from '@/lib/utils/cn';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-gray-200 dark:bg-dark-hover',
        className
      )}
    />
  );
}

export function OrderRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 border-b border-light-border dark:border-dark-border">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-9 w-20 rounded-xl" />
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="p-6 rounded-2xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border">
      <Skeleton className="h-6 w-40 mb-4" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}
