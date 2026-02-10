import { useLocaleStore } from '@/stores/useLocaleStore';
import { translations } from '@/lib/i18n';
import type { Translations } from '@/lib/i18n/types';

export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale);
  const t = (key: keyof Translations): string => {
    return translations[locale][key] ?? key;
  };
  return { t, locale };
}
