'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  variant?: 'default' | 'pills';
}

export function Tabs({ tabs, activeTab, onChange, className, variant = 'default' }: TabsProps) {
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeEl = tabRefs.current.get(activeTab);
    const container = containerRef.current;
    if (activeEl && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = activeEl.getBoundingClientRect();
      setIndicatorStyle({
        left: elRect.left - containerRect.left,
        width: elRect.width,
      });
    }
  }, [activeTab]);

  if (variant === 'pills') {
    return (
      <div className={cn('flex gap-2', className)}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
              activeTab === tab.id
                ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/25'
                : 'bg-light-hover dark:bg-dark-hover text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            <span className="flex items-center gap-2">
              {tab.icon}
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative flex border-b border-light-border dark:border-dark-border', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => {
            if (el) tabRefs.current.set(tab.id, el);
          }}
          onClick={() => onChange(tab.id)}
          className={cn(
            'relative px-4 py-3 text-sm font-medium transition-colors duration-200',
            activeTab === tab.id
              ? 'text-accent-blue'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          )}
        >
          <span className="flex items-center gap-2">
            {tab.icon}
            {tab.label}
          </span>
        </button>
      ))}
      <motion.div
        className="absolute bottom-0 h-0.5 bg-accent-blue rounded-full"
        animate={indicatorStyle}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      />
    </div>
  );
}

interface TabPanelProps {
  children: ReactNode;
  className?: string;
}

export function TabPanel({ children, className }: TabPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
