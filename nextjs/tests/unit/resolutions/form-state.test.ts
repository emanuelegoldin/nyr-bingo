/**
 * Unit tests for the state the resolution dialog opens with.
 * Spec Reference: 03-personal-resolutions.md - Create Dialog
 */

import { describe, expect, it } from 'vitest';
import { initialResolutionFormState } from '@/lib/shared/resolution-form';

describe('resolution form state', () => {
  it('opens an empty Common form for a new resolution (03-personal-resolutions.md – Create Dialog)', () => {
    // Act
    const state = initialResolutionFormState(undefined);

    // Assert
    expect(state).toEqual({ type: 'base', title: '', text: '', subtasks: [], numberOfRepetition: 2 });
  });

  it('opens the resolution being edited with its own values (03-personal-resolutions.md – Create Dialog)', () => {
    // Arrange
    const subtasks = [{ title: 'Pack', description: '' }];

    // Act
    const state = initialResolutionFormState({ id: 'r1', type: 'compound', title: 'Trip', text: 'Go away', subtasks });

    // Assert
    expect(state).toEqual({ type: 'compound', title: 'Trip', text: 'Go away', subtasks, numberOfRepetition: 2 });
  });
});
