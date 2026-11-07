/**
 * Unit tests for the supported locales and the default one.
 * Spec Reference: 15-internationalization.md - Locales
 */

import { describe, expect, it } from 'vitest';
import { defaultLocale, isAppLocale } from '@/i18n/config';

describe('locales', () => {
  it.each(['en', 'de', 'it'])('supports %s (15-internationalization.md – Locales)', (locale) => {
    // Act
    const result = isAppLocale(locale);

    // Assert
    expect(result).toBe(true);
  });

  it.each(['fr', 'EN', '', undefined])('does not support %s, so the default applies (15-internationalization.md – Locales)', (locale) => {
    // Act
    const result = isAppLocale(locale);

    // Assert
    expect(result).toBe(false);
  });

  it('defaults to en (15-internationalization.md – Locales)', () => {
    // Assert
    expect(defaultLocale).toBe('en');
  });
});
