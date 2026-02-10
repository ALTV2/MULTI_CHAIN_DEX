'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SelectGroup<T = string> {
  label: string;
  options: SelectOption<T>[];
}

interface SelectProps<T = string> {
  value: T | undefined;
  onChange: (value: T) => void;
  options?: SelectOption<T>[];
  groups?: SelectGroup<T>[];
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
  allowCustom?: boolean;
  className?: string;
  renderOption?: (option: SelectOption<T>) => ReactNode;
}

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function Select<T extends string = string>({
  value,
  onChange,
  options = [],
  groups,
  placeholder = 'Select...',
  label,
  error,
  disabled,
  searchable,
  allowCustom,
  className,
  renderOption,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allOptions = groups
    ? groups.flatMap((g) => g.options)
    : options;

  const selected = allOptions.find((o) => o.value === value);
  const isCustomValue = value && !selected && allowCustom;

  const filteredOptions = search
    ? allOptions.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          o.description?.toLowerCase().includes(search.toLowerCase()) ||
          String(o.value).toLowerCase().includes(search.toLowerCase())
      )
    : allOptions;

  const filteredGroups = groups
    ? groups
        .map((g) => ({
          ...g,
          options: g.options.filter(
            (o) =>
              !search ||
              o.label.toLowerCase().includes(search.toLowerCase()) ||
              o.description?.toLowerCase().includes(search.toLowerCase()) ||
              String(o.value).toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter((g) => g.options.length > 0)
    : undefined;

  const showCustomOption =
    allowCustom &&
    searchable &&
    search &&
    ADDRESS_REGEX.test(search) &&
    !allOptions.some((o) => String(o.value).toLowerCase() === search.toLowerCase());

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && searchable) {
      inputRef.current?.focus();
    }
  }, [open, searchable]);

  function handleSelect(opt: SelectOption<T>) {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    setSearch('');
  }

  function handleCustomSelect() {
    onChange(search as T);
    setOpen(false);
    setSearch('');
  }

  function renderOpt(opt: SelectOption<T>) {
    if (renderOption) return renderOption(opt);
    return (
      <div className="flex items-center gap-2">
        {opt.icon}
        <div>
          <div className="text-sm font-medium">{opt.label}</div>
          {opt.description && (
            <div className="text-xs text-gray-400">{opt.description}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className={cn('relative w-full', open && 'z-[60]', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 rounded-xl',
          'bg-light-hover dark:bg-dark-hover',
          'border border-light-border dark:border-dark-border',
          'text-gray-900 dark:text-white',
          'focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent',
          'transition-all duration-200',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-accent-red focus:ring-accent-red'
        )}
      >
        <span className={cn(!selected && !isCustomValue && 'text-gray-400 dark:text-gray-500')}>
          {selected ? (
            <div className="flex items-center gap-2">
              {selected.icon}
              <span>{selected.label}</span>
            </div>
          ) : isCustomValue ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                ?
              </div>
              <span className="font-mono text-sm">{truncateAddress(String(value))}</span>
            </div>
          ) : (
            placeholder
          )}
        </span>
        <svg
          className={cn(
            'w-4 h-4 text-gray-400 transition-transform flex-shrink-0',
            open && 'rotate-180'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-[60] w-full mt-1 py-1',
              'bg-white dark:bg-[#1a1d24]',
              'border border-light-border dark:border-dark-border',
              'rounded-xl shadow-2xl shadow-black/20 dark:shadow-black/50',
              'max-h-60 overflow-auto'
            )}
          >
            {searchable && (
              <div className="px-3 py-2 border-b border-light-border dark:border-dark-border">
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={allowCustom ? 'Search or paste address...' : 'Search...'}
                  className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
                />
              </div>
            )}

            {filteredGroups
              ? filteredGroups.map((group) => (
                  <div key={group.label}>
                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {group.label}
                    </div>
                    {group.options.map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        disabled={opt.disabled}
                        onClick={() => handleSelect(opt)}
                        className={cn(
                          'w-full px-3 py-2 text-left transition-colors',
                          'hover:bg-light-hover dark:hover:bg-dark-hover',
                          opt.value === value && 'bg-accent-blue/10 text-accent-blue',
                          opt.disabled && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {renderOpt(opt)}
                      </button>
                    ))}
                  </div>
                ))
              : filteredOptions.map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt)}
                    className={cn(
                      'w-full px-3 py-2 text-left transition-colors',
                      'hover:bg-light-hover dark:hover:bg-dark-hover',
                      opt.value === value && 'bg-accent-blue/10 text-accent-blue',
                      opt.disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {renderOpt(opt)}
                  </button>
                ))}

            {showCustomOption && (
              <button
                type="button"
                onClick={handleCustomSelect}
                className="w-full px-3 py-2 text-left transition-colors hover:bg-light-hover dark:hover:bg-dark-hover border-t border-light-border dark:border-dark-border"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    ?
                  </div>
                  <div>
                    <div className="text-sm font-medium">Custom Token</div>
                    <div className="text-xs text-gray-400 font-mono">{truncateAddress(search)}</div>
                  </div>
                </div>
              </button>
            )}

            {filteredOptions.length === 0 && !showCustomOption && (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">
                {allowCustom ? 'Paste a token address (0x...)' : 'No options found'}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="mt-1.5 text-sm text-accent-red">{error}</p>}
    </div>
  );
}
