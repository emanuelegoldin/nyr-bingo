/**
 * Fixture builders: insert the toy data a test needs, inside the test's rolled-back transaction.
 * Spec Reference: 01-authentication.md - Registration, 16-games.md - Game Model, 05-bingo-card-generation.md - Data Model Notes
 */

import { randomUUID } from 'node:crypto';
import { CellState, GameStatus, ResolutionType } from '@/lib/shared/types';
import { execute } from './test-connection';

/** A user created by createUser. */
export interface UserFixture {
  id: string;
  username: string;
  email: string;
}

/** A team created by createTeam. */
export interface TeamFixture {
  id: string;
  leaderId: string;
}

/** A game created by createGame. */
export interface GameFixture {
  id: string;
  teamId: string;
}

/** What one cell of a fixture card holds. Every field has a default. */
export interface CellFixtureInput {
  /** Where the content comes from; 'empty' makes a filler cell (default 'personal') */
  source?: 'personal' | 'team' | 'empty';
  /** The snapshot's type (default base; always base for empty cells) */
  type?: ResolutionType;
  /** The cell's state (default pending) */
  state?: CellState;
}

/** A card created by createCard. */
export interface CardFixture {
  id: string;
  gameId: string;
  ownerId: string;
  /** The cell ids, in the order of the cells passed in (position = index) */
  cellIds: string[];
}

/** Everything createPlayingCard builds around one card. */
export interface PlayingCardFixture {
  owner: UserFixture;
  team: TeamFixture;
  game: GameFixture;
  card: CardFixture;
}

/**
 * Insert a verified user with a profile (getTeamWithMembers and similar reads JOIN user_profiles).
 * @param overrides Values to use instead of the generated ones
 * @returns The created user
 */
export const createUser = async (overrides: Partial<UserFixture> = {}): Promise<UserFixture> => {
  const id = overrides.id ?? randomUUID();
  const suffix = id.slice(0, 8);
  const user: UserFixture = {
    id,
    username: overrides.username ?? `user_${suffix}`,
    email: overrides.email ?? `user_${suffix}@test.local`,
  };

  await execute(
    'INSERT INTO users (id, username, email, password_hash, email_verified_at) VALUES (?, ?, ?, ?, NOW())',
    [user.id, user.username, user.email, 'not-a-real-hash']
  );
  await execute(
    'INSERT INTO user_profiles (id, user_id, display_name) VALUES (?, ?, ?)',
    [randomUUID(), user.id, user.username]
  );

  return user;
};

/**
 * Insert a team with its leader as the only member.
 * @param leader The user who leads the team
 * @returns The created team
 */
export const createTeam = async (leader: UserFixture): Promise<TeamFixture> => {
  const id = randomUUID();

  await execute('INSERT INTO teams (id, name) VALUES (?, ?)', [id, `team_${id.slice(0, 8)}`]);
  await execute(
    "INSERT INTO team_memberships (id, team_id, user_id, role) VALUES (?, ?, ?, 'leader')",
    [randomUUID(), id, leader.id]
  );

  return { id, leaderId: leader.id };
};

/**
 * Insert a game of a team, with the given users as its players.
 * @param team The team the game belongs to
 * @param players The users who play it
 * @param status The game's status (default started)
 * @returns The created game
 */
export const createGame = async (
  team: TeamFixture,
  players: UserFixture[],
  status: GameStatus = GameStatus.STARTED
): Promise<GameFixture> => {
  const id = randomUUID();

  await execute(
    'INSERT INTO games (id, team_id, name, status) VALUES (?, ?, ?, ?)',
    [id, team.id, `game_${id.slice(0, 8)}`, status]
  );
  for (const player of players) {
    await execute('INSERT INTO game_players (game_id, user_id) VALUES (?, ?)', [id, player.id]);
  }

  return { id, teamId: team.id };
};

/**
 * Insert one cell with its snapshot: a title, the type's target or subtasks, and no progress.
 * @param cardId The card the cell is on
 * @param ownerId The card owner, recorded as the source user of personal cells
 * @param position The cell's position on the card
 * @param input What the cell holds
 * @returns The cell id
 */
const insertCell = async (
  cardId: string,
  ownerId: string,
  position: number,
  input: CellFixtureInput
): Promise<string> => {
  const id = randomUUID();
  const source = input.source ?? 'personal';
  const isEmpty = source === 'empty';
  const type = isEmpty ? ResolutionType.BASE : (input.type ?? ResolutionType.BASE);

  await execute(
    `INSERT INTO bingo_cells
       (id, card_id, position, source_type, source_user_id, state, resolution_type, title, number_of_repetition)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      cardId,
      position,
      source,
      source === 'personal' ? ownerId : null,
      input.state ?? CellState.PENDING,
      type,
      isEmpty ? null : `Cell ${position}`,
      type === ResolutionType.ITERATIVE ? 3 : null,
    ]
  );

  if (type === ResolutionType.COMPOUND) {
    for (const index of [0, 1]) {
      await execute(
        'INSERT INTO bingo_cell_subtasks (cell_id, subtask_index, title, completed) VALUES (?, ?, ?, 0)',
        [id, index, `Subtask ${index}`]
      );
    }
  }

  return id;
};

/**
 * Insert a user's card in a game, with the given cells at positions 0, 1, 2, ...
 * @param game The game the card belongs to
 * @param owner The card owner (should be a player of the game)
 * @param cells What each cell holds
 * @returns The created card and its cell ids
 */
export const createCard = async (
  game: GameFixture,
  owner: UserFixture,
  cells: CellFixtureInput[]
): Promise<CardFixture> => {
  const id = randomUUID();

  await execute(
    'INSERT INTO bingo_cards (id, team_id, user_id, game_id) VALUES (?, ?, ?, ?)',
    [id, game.teamId, owner.id, game.id]
  );

  const cellIds: string[] = [];
  for (const [position, input] of cells.entries()) {
    cellIds.push(await insertCell(id, owner.id, position, input));
  }

  return { id, gameId: game.id, ownerId: owner.id, cellIds };
};

/**
 * Shortcut for the usual setup: a user leading a one-member team, playing a game, with a card.
 * @param cells What each cell of the card holds
 * @param gameStatus The game's status (default started)
 * @returns The owner, team, game and card
 */
export const createPlayingCard = async (
  cells: CellFixtureInput[],
  gameStatus: GameStatus = GameStatus.STARTED
): Promise<PlayingCardFixture> => {
  const owner = await createUser();
  const team = await createTeam(owner);
  const game = await createGame(team, [owner], gameStatus);
  const card = await createCard(game, owner, cells);

  return { owner, team, game, card };
};

/**
 * Insert a personal resolution of a user, which can be placed on their card.
 * @param owner The resolution's owner
 * @param title The resolution's title
 * @returns The resolution id
 */
export const createPersonalResolution = async (owner: UserFixture, title: string): Promise<string> => {
  const id = randomUUID();

  await execute(
    "INSERT INTO resolutions (id, owner_user_id, title, scope, resolution_type) VALUES (?, ?, ?, 'personal', 'base')",
    [id, owner.id, title]
  );

  return id;
};
