/**
 * Unit tests that every locale defines exactly the keys of en, each with a text.
 * Spec Reference: 15-internationalization.md - Translation Module
 *
 * The type check enforces the same rule, but the build does not run it, so this test keeps it in CI.
 */

import { describe, expect, it } from 'vitest';
import { messages } from '@/i18n/messages';

/** A nested message tree as stored in the JSON files. */
type MessageTree = { [key: string]: string | MessageTree };

/**
 * Flatten a message tree into dotted keys and their texts.
 * @param tree The messages
 * @param prefix The key of the tree itself
 * @returns One entry per text
 */
const flatten = (tree: MessageTree, prefix = ''): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value] as [string, string]] : flatten(value, `${prefix}${key}.`)
  );

const enKeys = flatten(messages.en as MessageTree).map(([key]) => key).sort();

describe('message keys', () => {
  it.each(['de', 'it'] as const)('%s has exactly the keys of en (15-internationalization.md – Translation Module)', (locale) => {
    // Act
    const keys = flatten(messages[locale] as MessageTree).map(([key]) => key).sort();

    // Assert
    expect(keys).toEqual(enKeys);
  });

  it.each(['en', 'de', 'it'] as const)('%s has no empty text (15-internationalization.md – Translation Module)', (locale) => {
    // Act
    const empty = flatten(messages[locale] as MessageTree).filter(([, text]) => text.trim() === '');

    // Assert
    expect(empty).toEqual([]);
  });
});
