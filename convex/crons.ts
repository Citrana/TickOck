import {cronJobs} from 'convex/server';
import {internal} from './_generated/api';

const crons = cronJobs();

crons.interval(
  'event-reminders',
  {hours: 1},
  internal.pushNotifications.sendEventReminders,
  {},
);

crons.interval(
  'release-expired-seat-holds',
  {minutes: 1},
  internal.seatHolds.releaseExpiredInternal,
  {},
);

export default crons;
