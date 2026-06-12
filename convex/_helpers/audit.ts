// Reusable audit log writer — call from every mutation after the DB write.
// AuditLogs are append-only: this file must never patch or delete rows.

import {Id} from '../_generated/dataModel';
import {MutationCtx} from '../_generated/server';

export interface AuditLogArgs {
  actorId: Id<'users'>;
  /** Human-readable role name at the time of the action (denormalised for log durability). */
  actorRole?: string;
  /** Permission slug or descriptive verb, e.g. "events:edit", "users:suspend". */
  action: string;
  /** Table name of the affected document. */
  targetType: string;
  /** String form of the affected document's _id. */
  targetId: string;
  /** Any extra context. Pass a plain object — it will be JSON-serialised. */
  metadata?: Record<string, string | number | boolean | null>;
  ip?: string;
}

export async function writeAuditLog(
  ctx: MutationCtx,
  args: AuditLogArgs,
): Promise<void> {
  await ctx.db.insert('auditLogs', {
    actorId: args.actorId,
    actorRole: args.actorRole,
    action: args.action,
    targetType: args.targetType,
    targetId: args.targetId,
    metadata: args.metadata ? JSON.stringify(args.metadata) : undefined,
    ip: args.ip,
    createdAt: Date.now(),
  });
}
