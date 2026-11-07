/**
 * Route tests for turning notifications on or off.
 * Spec Reference: 19-notifications.md - Settings, API
 */

import { describe, expect, it } from 'vitest';
import { PUT as saveSettings } from '@/app/api/notifications/settings/route';
import { createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';

describe('notifications – settings', () => {
  describe('operations', () => {
    it('turns notifications off (19-notifications.md – Settings)', async () => {
      // Arrange
      const user = await createUser();
      await signInAs(user);

      // Act
      const result = await callRoute(saveSettings, { method: 'PUT', body: { enabled: false } });

      // Assert
      expect(result.status).toBe(200);
      expect(await countRows('notification_settings', 'user_id = ? AND enabled = 0', [user.id])).toBe(1);
    });
  });

  describe('rejects', () => {
    it.each(['false', 0, null])('enabled set to %s, which is not a boolean, with 400 (19-notifications.md – API)', async (enabled) => {
      // Arrange
      const user = await createUser();
      await signInAs(user);

      // Act
      const result = await callRoute(saveSettings, { method: 'PUT', body: { enabled } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('notification_settings', 'user_id = ?', [user.id])).toBe(0);
    });
  });
});
