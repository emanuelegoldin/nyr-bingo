/**
 * Unit tests for the number of personal resolutions a player needs to fill their card.
 * Spec Reference: 03-personal-resolutions.md - Personal Target
 */

import { describe, expect, it } from 'vitest';
import { getPersonalResolutionTarget } from '@/lib/shared/personal-target';

describe('personal target', () => {
  it.each([
    { gridSize: 5, players: 4, target: 20 },
    { gridSize: 5, players: 1, target: 23 },
    { gridSize: 3, players: 2, target: 6 },
    { gridSize: 9, players: 10, target: 70 },
  ])('asks a player of a $gridSize×$gridSize game with $players players for $target resolutions (03-personal-resolutions.md – Personal Target)', ({ gridSize, players, target }) => {
    // Act
    const result = getPersonalResolutionTarget(gridSize, players);

    // Assert
    expect(result).toBe(target);
  });

  it('never asks for fewer than zero resolutions (03-personal-resolutions.md – Personal Target)', () => {
    // Act
    const result = getPersonalResolutionTarget(3, 12);

    // Assert
    expect(result).toBe(0);
  });
});
