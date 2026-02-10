'use client';

import { Card, CardContent } from '@/components/ui/Card';
import { useTranslation } from '@/hooks/useTranslation';

const features = [
  {
    titleKey: 'about.feature1.title' as const,
    descKey: 'about.feature1.desc' as const,
    icon: (
      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    gradient: 'from-accent-blue to-blue-600',
  },
  {
    titleKey: 'about.feature2.title' as const,
    descKey: 'about.feature2.desc' as const,
    icon: (
      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    gradient: 'from-accent-purple to-purple-600',
  },
  {
    titleKey: 'about.feature3.title' as const,
    descKey: 'about.feature3.desc' as const,
    icon: (
      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    gradient: 'from-accent-green to-green-600',
  },
  {
    titleKey: 'about.feature4.title' as const,
    descKey: 'about.feature4.desc' as const,
    icon: (
      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
    gradient: 'from-accent-orange to-orange-600',
  },
];

export function AboutSection() {
  const { t } = useTranslation();

  return (
    <Card variant="glass-strong">
      <CardContent className="py-2">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {t('about.title')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-2xl">
          {t('about.desc')}
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {features.map((feature) => (
            <div key={feature.titleKey} className="flex gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                {feature.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                  {t(feature.titleKey)}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                  {t(feature.descKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
