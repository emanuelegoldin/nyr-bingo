const dictionaries = {
    en: true,
    it: true,
    de: true,
} as const;

export type Locale = keyof typeof dictionaries;
export const LOCALE_COOKIE_NAME = 'locale';

export const hasLocale = (locale: string): locale is Locale =>
    locale in dictionaries;