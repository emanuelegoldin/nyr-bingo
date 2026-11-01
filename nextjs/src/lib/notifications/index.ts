/**
 * The notification module (spec 19). Replacing the implementation means changing this one export.
 */

import { dbPublisher } from './db-publisher';
import type { NotificationPublisher } from './types';

export const notifications: NotificationPublisher = dbPublisher;
