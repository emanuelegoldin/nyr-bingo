/**
 * Fixture builders: insert the toy data a test needs, inside the test's rolled-back transaction.
 * Spec Reference: 01-authentication.md - Registration, 04-bingo-teams.md - Invitations / Joining, 16-games.md - Game Model, 05-bingo-card-generation.md - Data Model Notes, 07-proof-and-approval.md - Review Thread Model, 23-progress-chart.md - Data Model
 */

import { randomUUID } from 'node:crypto';
import { CellState, GameStatus, InvitationStatus, ResolutionType, TeamRole, VoteType } from '@/lib/shared/types';
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
  /** The resolution the cell was filled from (default none) */
  resolutionId?: string;
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
       (id, card_id, position, source_type, source_user_id, state, resolution_type, title, number_of_repetition,
        resolution_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      input.resolutionId ?? null,
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

/**
 * Add a user to a team.
 * @param team The team
 * @param user The new member
 * @param role The stored role (default member; leader makes them a Team Admin)
 */
export const addMember = async (
  team: TeamFixture,
  user: UserFixture,
  role: TeamRole = TeamRole.MEMBER
): Promise<void> => {
  await execute(
    'INSERT INTO team_memberships (id, team_id, user_id, role) VALUES (?, ?, ?, ?)',
    [randomUUID(), team.id, user.id, role]
  );
};

/** What an invitation created by createInvitation looks like. */
export interface InvitationFixtureInput {
  /** The invitation's status (default pending) */
  status?: InvitationStatus;
  /** True for an invitation whose 7 days are over (default false) */
  expired?: boolean;
}

/**
 * Insert an invitation to a team.
 * @param team The team
 * @param input Its status and whether it has expired
 * @returns The invite code
 */
export const createInvitation = async (
  team: TeamFixture,
  input: InvitationFixtureInput = {}
): Promise<string> => {
  const inviteCode = randomUUID();
  const expiresAt = input.expired ? 'NOW() - INTERVAL 1 DAY' : 'NOW() + INTERVAL 7 DAY';

  await execute(
    `INSERT INTO team_invitations (id, team_id, invite_code, status, expires_at) VALUES (?, ?, ?, ?, ${expiresAt})`,
    [randomUUID(), team.id, inviteCode, input.status ?? InvitationStatus.PENDING]
  );

  return inviteCode;
};

/**
 * Insert the team goal of a game.
 * @param game The game
 * @param owner The admin who sets it
 * @returns The resolution id
 */
export const createTeamGoal = async (game: GameFixture, owner: UserFixture): Promise<string> => {
  const id = randomUUID();

  await execute(
    "INSERT INTO resolutions (id, owner_user_id, title, scope, resolution_type, team_id, game_id) VALUES (?, ?, 'Team goal', 'team', 'base', ?, ?)",
    [id, owner.id, game.teamId, game.id]
  );

  return id;
};

/**
 * Insert a member-provided resolution, written by one player of a game for another.
 * @param game The game
 * @param author The player who writes it
 * @param recipient The player it is for
 * @returns The resolution id
 */
export const createMemberResolution = async (
  game: GameFixture,
  author: UserFixture,
  recipient: UserFixture
): Promise<string> => {
  const id = randomUUID();

  await execute(
    `INSERT INTO resolutions (id, owner_user_id, title, scope, resolution_type, team_id, game_id, to_user_id)
     VALUES (?, ?, 'For you', 'member_provided', 'base', ?, ?, ?)`,
    [id, author.id, game.teamId, game.id, recipient.id]
  );

  return id;
};

/**
 * Insert a player's leaderboard row in a game, with no progress.
 * @param game The game
 * @param player The player
 */
export const createLeaderboardRow = async (game: GameFixture, player: UserFixture): Promise<void> => {
  await execute(
    'INSERT INTO team_leaderboard (user_id, team_id, game_id, completed_tasks) VALUES (?, ?, ?, 0)',
    [player.id, game.teamId, game.id]
  );
};

/** What a review thread created by createThread looks like. */
export interface ThreadFixtureInput {
  /** Closed threads get closed_at and the outcome (default open) */
  closedWithOutcome?: 'accomplished' | 'pending';
  /** How many days ago it was opened (default 0) */
  ageDays?: number;
}

/**
 * Insert a review thread on a cell. The cell's state is the caller's choice: an open thread
 * normally sits on a pending_review cell.
 * @param cellId The cell under review
 * @param completedBy The card owner, who completed the cell
 * @param input Whether it is closed and how old it is
 * @returns The thread id
 */
export const createThread = async (
  cellId: string,
  completedBy: UserFixture,
  input: ThreadFixtureInput = {}
): Promise<string> => {
  const id = randomUUID();
  const outcome = input.closedWithOutcome ?? null;

  await execute(
    `INSERT INTO review_threads (id, cell_id, completed_by_user_id, status, created_at, closed_at, outcome)
     VALUES (?, ?, ?, ?, NOW() - INTERVAL ? DAY, ${outcome ? 'NOW()' : 'NULL'}, ?)`,
    [id, cellId, completedBy.id, outcome ? 'closed' : 'open', input.ageDays ?? 0, outcome]
  );

  return id;
};

/**
 * Insert a vote on a review thread.
 * @param threadId The thread
 * @param voter The player voting
 * @param vote accept or deny
 */
export const createVote = async (threadId: string, voter: UserFixture, vote: VoteType): Promise<void> => {
  await execute(
    'INSERT INTO review_votes (id, thread_id, voter_user_id, vote) VALUES (?, ?, ?, ?)',
    [randomUUID(), threadId, voter.id, vote]
  );
};

/**
 * Insert a message in a review thread.
 * @param threadId The thread
 * @param author The player writing it
 * @param content The message text
 */
export const createThreadMessage = async (threadId: string, author: UserFixture, content: string): Promise<void> => {
  await execute(
    'INSERT INTO review_messages (id, thread_id, author_user_id, content) VALUES (?, ?, ?, ?)',
    [randomUUID(), threadId, author.id, content]
  );
};

/**
 * Insert a progress point of a player in a game, recorded now.
 * @param game The game
 * @param player The player
 * @param completedTasks The player's completed count from then on
 */
export const createProgressPoint = async (
  game: GameFixture,
  player: UserFixture,
  completedTasks: number
): Promise<void> => {
  await execute(
    'INSERT INTO leaderboard_progress (game_id, user_id, recorded_at, completed_tasks) VALUES (?, ?, NOW(), ?)',
    [game.id, player.id, completedTasks]
  );
};
