import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { getDictionaryForLocale } from './dictionary';
import { hasLocale, LOCALE_COOKIE_NAME, type Locale } from './locale';

export const getLocaleFromRequest = async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const storedLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  return storedLocale && hasLocale(storedLocale) ? storedLocale : 'en';
};

export const getDictionary = async (locale?: Locale) => {
  const resolvedLocale = locale ?? (await getLocaleFromRequest());

  return getDictionaryForLocale(resolvedLocale);
};

export default getRequestConfig(async () => {
  const locale = await getLocaleFromRequest();

  return {
    locale,
    messages: getDictionaryForLocale(locale),
  };
});