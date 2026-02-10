import type { Locale, Translations } from './types';
import { en } from './en';
import { ru } from './ru';

export const translations: Record<Locale, Translations> = { en, ru };

export type { Locale, Translations };
