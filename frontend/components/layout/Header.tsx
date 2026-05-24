'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { UnifiedWalletButton } from '@/components/wallet/UnifiedWalletButton';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocaleStore } from '@/stores/useLocaleStore';
import { cn } from '@/lib/utils/cn';
import type { Translations } from '@/lib/i18n/types';

const navIcons = {
  dashboard: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  orders: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  swap: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
  profile: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
};

type NavItem = {
  href: string;
  labelKey: keyof Translations;
  iconKey: keyof typeof navIcons;
};

const navItems: NavItem[] = [
  { href: '/', labelKey: 'nav.dashboard', iconKey: 'dashboard' },
  { href: '/orders', labelKey: 'nav.orders', iconKey: 'orders' },
  { href: '/profile', labelKey: 'nav.profile', iconKey: 'profile' },
];

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useTranslation();
  const { locale, setLocale } = useLocaleStore();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-light-border/50 dark:border-dark-border/50 bg-light-bg/80 dark:bg-dark-bg/80 backdrop-blur-2xl">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center shadow-lg shadow-accent-blue/20 group-hover:shadow-accent-blue/30 transition-shadow">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-lg text-gray-900 dark:text-white">Multi-Chain</span>
              <span className="font-bold text-lg text-gradient ml-1">DEX</span>
            </div>
          </Link>

          {/* Navigation — Desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'text-accent-blue'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  )}
                >
                  {navIcons[item.iconKey]}
                  {t(item.labelKey)}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent-blue rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocale(locale === 'en' ? 'ru' : 'en')}
              className={cn(
                'relative inline-flex items-center justify-center w-9 h-9 rounded-xl',
                'bg-light-hover dark:bg-dark-hover',
                'hover:bg-light-card dark:hover:bg-dark-card',
                'border border-light-border dark:border-dark-border',
                'transition-colors duration-200',
                'text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              )}
              aria-label={locale === 'en' ? 'Switch to Russian' : 'Switch to English'}
              title={locale === 'en' ? 'Переключить на русский' : 'Switch to English'}
            >
              {locale === 'en' ? 'RU' : 'EN'}
            </button>
            <ThemeToggle />

            {/* Unified Wallet Button */}
            <UnifiedWalletButton />

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-light-hover dark:hover:bg-dark-hover"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden pb-4 space-y-1 animate-fade-in">
            {navItems.map((item) => {
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent-blue/10 text-accent-blue'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-light-hover dark:hover:bg-dark-hover'
                  )}
                >
                  {navIcons[item.iconKey]}
                  {t(item.labelKey)}
                </Link>
              );
            })}

            <button
              onClick={() => {
                setLocale(locale === 'en' ? 'ru' : 'en');
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-light-hover dark:hover:bg-dark-hover w-full"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              {locale === 'en' ? 'Русский' : 'English'}
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
