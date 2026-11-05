# Internationalization

The app uses [next-intl](https://next-intl.dev) without locale routing: the locale lives in the
`locale` cookie, not in the URL (spec 15). Supported locales are `en` (default), `de` and `it`.

## Layout

```
src/i18n/
  config.ts          locales, default locale, cookie name, locale names
  request.ts         next-intl request config: reads the cookie and loads the messages
  next-intl.d.ts     types message keys and the locale from the English messages
  use-set-locale.ts  client hook that writes the cookie and refreshes the page
  messages/
    index.ts         assembles the namespaces and checks every locale has the same keys
    en/<Namespace>.json
    de/<Namespace>.json
    it/<Namespace>.json
```

The language switcher is `src/components/locale-switcher.tsx`.

## Using translations

Client component:

```tsx
'use client';
import { useTranslations } from 'next-intl';

export function InviteButton({ teamName }: { teamName: string }) {
  const t = useTranslations('Teams');
  return <Button>{t('inviteDialog.open', { teamName })}</Button>;
}
```

Server component:

```tsx
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('Dashboard');
  return <h1>{t('title')}</h1>;
}
```

- Placeholders and plurals use ICU syntax: `"members": "{count, plural, one {# member} other {# members}}"`.
- Bold or linked parts inside a sentence: `t.rich('key', { b: (chunks) => <strong>{chunks}</strong> })`.
- Dates: `useFormatter().dateTime(date, options)` so they follow the active locale.
- API failures: `useApiErrorToast()` from `src/hooks/use-api-error-toast.ts` shows the server's
  message with a translated title and fallback.
- Shared words live in `Common`; resolution types, cell states and cell sources in `Labels`.
- Constants keep keys, not text, and are translated when rendering.

## Adding a string

1. Add the key to `messages/en/<Namespace>.json`.
2. Add the same key to `de` and `it`. German uses "du", Italian uses "tu".
3. Run the type check. It fails on an unknown key or when a locale's keys differ from `en`:

   ```
   tsc --noEmit
   ```

   `next build` ignores type errors (`ignoreBuildErrors`), so run the type check yourself.

## Adding a namespace

Create `<Namespace>.json` in each locale folder, then import it and add it to the three locale
objects in `messages/index.ts`.
