/**
 * Unit tests for the text two resolutions are compared by when a card avoids duplicates.
 * Spec Reference: 05-bingo-card-generation.md - Duplicate Handling
 */

import { describe, expect, it } from 'vitest';
import { getResolutionTextKey } from '@/lib/shared/resolution-type';

describe('resolution text key', () => {
  it('treats texts that differ only in case as duplicates (05-bingo-card-generation.md – Duplicate Handling)', () => {
    // Act
    const upper = getResolutionTextKey('Run a marathon');
    const lower = getResolutionTextKey('run a MARATHON');

    // Assert
    expect(upper).toBe(lower);
  });

  it('compares the description when there is one (05-bingo-card-generation.md – Duplicate Handling)', () => {
    // Act
    const key = getResolutionTextKey('Marathon', 'Run a marathon');

    // Assert
    expect(key).toBe(getResolutionTextKey('Run a marathon'));
  });
});
