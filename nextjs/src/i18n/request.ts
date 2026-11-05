import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, isAppLocale, LOCALE_COOKIE_NAME } from './config';
import { messages } from './messages';

/**
 * Per-request next-intl configuration: the locale comes from the `locale` cookie,
 * falling back to the default locale when it is missing or unknown (spec 15).
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const storedLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale = isAppLocale(storedLocale) ? storedLocale : defaultLocale;

  return {
    locale,
    messages: messages[locale],
  };
});
