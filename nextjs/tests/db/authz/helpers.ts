/**
 * Helpers shared by the authorization DB tests: loading users and games the way routes do.
 * Spec Reference: 21-authorization.md - Scopes and Roles
 */

import { getGameById } from '@/lib/db/game-repository';
import type { Game, User } from '@/lib/db/types';
import { findUserById } from '@/lib/db/user-repository';
import {
  addMember,
  createGame,
  createTeam,
  createUser,
  type GameFixture,
  type TeamFixture,
  type UserFixture,
} from '../../support/db/fixtures';
import { execute } from '../../support/db/test-connection';

/**
 * Load a fixture user as the logged-in user.
 * @param fixture The user
 * @returns The user
 */
export const loadUser = async (fixture: UserFixture): Promise<User> => {
  const user = await findUserById(fixture.id);
  if (!user) throw new Error('Fixture user not found');
  return user;
};

/**
 * Load a fixture user as the logged-in user, with an unverified email.
 * @param fixture The user
 * @returns The user
 */
export const loadUnverifiedUser = async (fixture: UserFixture): Promise<User> => {
  await execute('UPDATE users SET email_verified_at = NULL WHERE id = ?', [fixture.id]);
  return loadUser(fixture);
};

/**
 * Load a fixture game as the routes do.
 * @param fixture The game
 * @returns The game
 */
export const loadGame = async (fixture: GameFixture): Promise<Game> => {
  const game = await getGameById(fixture.id);
  if (!game) throw new Error('Fixture game not found');
  return game;
};

/** A team with an admin and a member who both play a game, an admin who does not, and an outsider. */
export interface RolesSetup {
  admin: UserFixture;
  member: UserFixture;
  benchAdmin: UserFixture;
  outsider: UserFixture;
  team: TeamFixture;
  game: GameFixture;
}

/**
 * Build a team and a started game with one user per role.
 * @returns The users, team and game
 */
export const createRolesSetup = async (): Promise<RolesSetup> => {
  const [admin, member, benchAdmin, outsider] = [await createUser(), await createUser(), await createUser(), await createUser()];
  const team = await createTeam(admin);
  await addMember(team, member);
  await execute("INSERT INTO team_memberships (id, team_id, user_id, role) VALUES (UUID(), ?, ?, 'leader')", [team.id, benchAdmin.id]);
  const game = await createGame(team, [admin, member]);
  return { admin, member, benchAdmin, outsider, team, game };
};
