import type { AppLocale } from './config';
import type { Messages } from './messages';

// Types next-intl's locale and message keys, so an unknown key fails the type check (spec 15).
declare module 'next-intl' {
  interface AppConfig {
    Locale: AppLocale;
    Messages: Messages;
  }
}
