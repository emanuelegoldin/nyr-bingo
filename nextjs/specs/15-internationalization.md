# 15 — Internationalization

## Purpose

Let users choose the language of the application, and show every piece of interface text in that language.

---

## User Stories Covered

- Select my language from any page, through a control in the page header
- Keep my language across visits
- Read the whole interface, including messages, labels and dates, in my language

---

## In Scope

- Supported locales
- Locale selection and persistence
- The translation module
- Translated surfaces

---

## Functional Requirements

### Locales

- Supported locales: `en` (English), `de` (German), `it` (Italian).
- The default locale is `en`. It applies when no valid locale is stored.
- The locale is not part of the URL.
- German and Italian use the informal address ("du", "tu").

### Selection and Persistence

- The **language switcher** is a compact button with a globe icon and the active locale code (only the icon on narrow screens). It opens a menu listing each locale by its own name (English, Deutsch, Italiano), with a check mark on the active one.
- It appears in:
  - the application header, before the notification bell
  - the landing page header, next to the login and register links
  - the top right of the login, registration, invitation (`/join/...`) and email verification pages
- Selecting a language stores it in the `locale` cookie for one year and refreshes the page. The rest of the page state is kept.
- The server reads the cookie on each request and sets the `lang` attribute of the page.

### Translation Module

All translation code lives in `src/i18n/` and is built on `next-intl`:
- `config.ts` lists the locales, the default locale, the cookie name and the locale names.
- `request.ts` resolves the locale from the cookie and loads its messages.
- Messages live in `messages/<locale>/<Namespace>.json`, one file per namespace and locale. `messages/index.ts` assembles them.
- Every locale has exactly the same keys as `en`. The type check fails otherwise.
- Message keys are typed: using a key that does not exist in `en` fails the type check.
- Server components use `getTranslations()`; client components use `useTranslations()`.
- Placeholders and plurals use the ICU message syntax (`{name}`, `{count, plural, one {…} other {…}}`).
- Dates and relative times are formatted in the active locale.
- Code keeps translation keys, not text, in constants (navigation items, labels of states and types), and resolves them when rendering.

### Translated Surfaces

All text the interface shows is translated, including:
- Page and dialog titles, descriptions, labels, buttons, placeholders, empty and loading states
- Toast titles and descriptions written by the client, and the fallback text shown when a request fails without a message
- Form validation messages
- Accessible labels (`aria-label`, screen-reader-only text) and image descriptions
- Confirmation dialogs
- The page title and description (metadata)
- Notifications (spec 19)

Not translated:
- The app name "Resolution Bingo"
- Messages written by the server: API errors and success messages, shown as they arrive
- The verification email
- The prepared resolutions themselves (spec 17)
- Content entered by users

### Localized Assets

- The landing page uses a dedicated hero image for `it`.

---

## Acceptance Criteria

- A user can switch between English, German and Italian from the application header, the landing page, and the login, registration, invitation and verification pages.
- The switcher shows the active locale and lists each locale by its own name.
- The selection persists across visits.
- An unknown or missing locale falls back to English.
- Interface text, including toasts, validation messages, accessible labels and dates, renders in the selected language, except for the items listed under "Not translated".
- Every locale defines the same keys, enforced by the type check.
