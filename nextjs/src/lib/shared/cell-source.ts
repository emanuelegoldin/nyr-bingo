import type { useTranslations } from 'next-intl';
import { CellSourceType, type CellSourceLabel } from './types';

/** Minimal cell shape needed to derive the source label. */
export interface CellSourceInfo {
  sourceType: CellSourceType;
  sourceUserId: string | null;
}

/** Translation function of the `Labels` namespace. */
type LabelsTranslator = ReturnType<typeof useTranslations<'Labels'>>;

/**
 * Finds the name of the player who provided a member-provided resolution.
 * Spec: 16-games.md - Leaving a Game
 *
 * @param sourceUserId - The author, if known.
 * @param usernames - Map of user id to display name for the game's players.
 * @returns The author's name, or null when they are no longer a player ("Former Teammates").
 */
export function getProviderName(sourceUserId: string | null, usernames: Record<string, string>): string | null {
  return (sourceUserId ? usernames[sourceUserId] : undefined) ?? null;
}

/**
 * Describes where a cell's resolution came from, without any text, so the browser can show it
 * in the user's language (spec 15).
 *
 * @param cell - The cell (source type and optional source user id).
 * @param usernames - Map of user id to display name for the game's players.
 * @returns The team goal, the provider's name (or former teammates when they are no longer a
 *          player) for member-provided cells, suggested for prepared cells, and personal otherwise.
 */
export function getSourceLabel(cell: CellSourceInfo, usernames: Record<string, string>): CellSourceLabel {
  if (cell.sourceType === CellSourceType.TEAM) return { kind: 'team' };
  if (cell.sourceType === CellSourceType.MEMBER_PROVIDED) {
    const name = getProviderName(cell.sourceUserId, usernames);
    return name === null ? { kind: 'formerTeammates' } : { kind: 'member', name };
  }
  if (cell.sourceType === CellSourceType.PREPARED) return { kind: 'prepared' };
  return { kind: 'personal' };
}

/**
 * Turns a source label into the text shown in the badge.
 *
 * @param label - The source label.
 * @param t - Translation function of the `Labels` namespace.
 * @returns The provider's name, or the translated source.
 */
export function cellSourceText(label: CellSourceLabel, t: LabelsTranslator): string {
  return label.kind === 'member' ? label.name : t(`cellSource.${label.kind}`);
}
