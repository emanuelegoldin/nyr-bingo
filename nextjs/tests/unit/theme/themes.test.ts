/**
 * Unit tests for the supported themes and the default one.
 * Spec Reference: 25-theming.md - Themes
 */

import { describe, expect, it } from 'vitest';
import { defaultTheme, isAppTheme } from '@/lib/theme/config';

describe('themes', () => {
  it.each(['light', 'dark', 'system'])('supports %s (25-theming.md – Themes)', (theme) => {
    // Act
    const result = isAppTheme(theme);

    // Assert
    expect(result).toBe(true);
  });

  it.each(['blue', 'Dark', '', undefined])('does not support %s, so the default applies (25-theming.md – Themes)', (theme) => {
    // Act
    const result = isAppTheme(theme);

    // Assert
    expect(result).toBe(false);
  });

  it('defaults to system (25-theming.md – Themes)', () => {
    // Assert
    expect(defaultTheme).toBe('system');
  });
});
