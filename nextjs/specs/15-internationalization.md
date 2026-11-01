# 15 — Internationalization

## Purpose

Let users choose the language of the application.

---

## User Stories Covered

- Select my language from the landing page or the sidebar
- Keep my language across visits

---

## In Scope

- Supported locales
- Locale selection and persistence
- Translated surfaces

---

## Functional Requirements

### Locales

- Supported locales: `en` (English), `de` (German), `it` (Italian).
- The default locale is `en`. It applies when no valid locale is stored.
- The locale is not part of the URL.

### Selection and Persistence

- `LanguageSelectorDropdown` appears on the landing page and in the application sidebar.
- Selecting a language stores it in the `locale` cookie for one year and refreshes the page.
- The server reads the cookie on each request.

### Translations

- Strings live in `src/i18n/dictionaries/<locale>.json`, one file per locale with the same sections.
- Server components read them with `getDictionary()`. Client components use `getDictionaryForLocale()` with the language from `AppContext`, or receive the strings as props.

### Translated Surfaces

| Dictionary section | Surface |
| ------------------ | ------- |
| `App`, `Home` | Landing page content |
| `LoginPage` | Login page title, description and register link |
| `RegisterPage` | Registration page title, description and login link |
| `Dashboard` | Dashboard card title and description, empty-state heading and text, missing-card message |
| `ResolutionsPage` | Resolutions page title, description, history button label and browse button |
| `PreparedResolutionsDialog` | Prepared resolutions dialog text (spec 17) |
| `ResolutionHistoryDialog` | History dialog text |

Everything else is English only, including:
- The team, game and archive pages, the profile pages, the card cells and dialogs, and the resolution form
- The login and registration form fields, buttons and messages
- The dashboard's **Get Started** button and loading and error text
- The language selector's own labels and the landing page's version line
- The prepared resolutions themselves (spec 17)
- Toast titles and API error messages

### Localized Assets

- The landing page uses a dedicated hero image for `it`.

---

## Acceptance Criteria

- A user can switch between English, German and Italian.
- The selection persists across visits.
- An unknown or missing locale falls back to English.
- The strings listed under Translated Surfaces render in the selected language; other strings stay in English.
