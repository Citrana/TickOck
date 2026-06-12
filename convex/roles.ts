import {v} from 'convex/values';
import {internalMutation, mutation, query} from './_generated/server';
import {Id} from './_generated/dataModel';
import {assertPermission, requirePermission} from './_helpers/permissions';
import {writeAuditLog} from './_helpers/audit';

// ---------------------------------------------------------------------------
// Permission sets for the three built-in system roles.
// super_admin uses the '*' wildcard so it automatically covers any new slug.
// ---------------------------------------------------------------------------

const SYSTEM_ROLES = [
  {
    name: 'super_admin',
    permissionSlugs: ['*'],
    isSystem: true,
  },
  {
    name: 'admin',
    permissionSlugs: [
      'users:view',
      'users:edit',
      'users:suspend',
      'users:ban',
      'events:view',
      'events:edit',
      'events:delete',
      'tickets:read',
      'payments:view',
      'payments:confirm',
      'payments:reject',
      'payments:refund',
      'roles:view',
      'roles:create',
      'roles:assign',
      'staff:manage',
      'auditlogs:view',
    ],
    isSystem: true,
  },
  {
    name: 'support',
    permissionSlugs: [
      'users:view',
      'events:view',
      'tickets:read',
      'payments:view',
    ],
    isSystem: true,
  },
] as const;

// ---------------------------------------------------------------------------
// Bootstrap — no auth check because the DB is empty when this first runs.
// Safety: the mutation is idempotent; it no-ops if system roles already exist.
// ---------------------------------------------------------------------------

export const initSystemRoles = mutation({
  args: {},
  handler: async ctx => {
    const existing = await ctx.db
      .query('roles')
      .withIndex('by_name', q => q.eq('name', 'super_admin'))
      .unique();

    if (existing !== null) {
      return {seeded: false, message: 'System roles already exist'};
    }

    const ids: Record<string, Id<'roles'>> = {};
    for (const role of SYSTEM_ROLES) {
      ids[role.name] = await ctx.db.insert('roles', {
        name: role.name,
        permissionSlugs: [...role.permissionSlugs],
        isSystem: role.isSystem,
      });
    }

    return {seeded: true, ids};
  },
});

// Internal variant for use by other Convex functions (e.g. a cron or startup action).
export const seedSystemRolesInternal = internalMutation({
  args: {},
  handler: async ctx => {
    const existing = await ctx.db
      .query('roles')
      .withIndex('by_name', q => q.eq('name', 'super_admin'))
      .unique();

    if (existing !== null) return;

    for (const role of SYSTEM_ROLES) {
      await ctx.db.insert('roles', {
        name: role.name,
        permissionSlugs: [...role.permissionSlugs],
        isSystem: role.isSystem,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const list = query({
  args: {},
  handler: async ctx => {
    await assertPermission(ctx, 'roles:view');
    return ctx.db.query('roles').order('asc').take(100);
  },
});

export const get = query({
  args: {roleId: v.id('roles')},
  handler: async (ctx, args) => {
    await assertPermission(ctx, 'roles:view');
    return ctx.db.get(args.roleId);
  },
});

// ---------------------------------------------------------------------------
// Mutations — role management
// ---------------------------------------------------------------------------

export const create = mutation({
  args: {
    name: v.string(),
    permissionSlugs: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requirePermission(ctx, 'roles:create');

    const existing = await ctx.db
      .query('roles')
      .withIndex('by_name', q => q.eq('name', args.name))
      .unique();
    if (existing !== null) throw new Error(`Role "${args.name}" already exists`);

    const roleId = await ctx.db.insert('roles', {
      name: args.name,
      permissionSlugs: args.permissionSlugs,
      isSystem: false,
    });

    await writeAuditLog(ctx, {
      actorId,
      action: 'roles:create',
      targetType: 'roles',
      targetId: roleId,
      metadata: {name: args.name},
    });

    return roleId;
  },
});

export const updatePermissions = mutation({
  args: {
    roleId: v.id('roles'),
    permissionSlugs: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requirePermission(ctx, 'roles:create');

    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error('Role not found');
    if (role.isSystem) throw new Error('Cannot modify a system role');

    await ctx.db.patch(args.roleId, {permissionSlugs: args.permissionSlugs});

    await writeAuditLog(ctx, {
      actorId,
      action: 'roles:update',
      targetType: 'roles',
      targetId: args.roleId,
      metadata: {name: role.name},
    });
  },
});

export const remove = mutation({
  args: {roleId: v.id('roles')},
  handler: async (ctx, args) => {
    const actorId = await requirePermission(ctx, 'roles:create');

    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error('Role not found');
    if (role.isSystem) throw new Error('Cannot delete a system role');

    // Prevent deletion if any user is currently assigned this role
    const assignedUser = await ctx.db
      .query('users')
      .withIndex('by_platformRoleId', q => q.eq('platformRoleId', args.roleId))
      .first();
    if (assignedUser !== null) {
      throw new Error('Cannot delete a role that is still assigned to users');
    }

    await ctx.db.delete(args.roleId);

    await writeAuditLog(ctx, {
      actorId,
      action: 'roles:delete',
      targetType: 'roles',
      targetId: args.roleId,
      metadata: {name: role.name},
    });
  },
});

// ---------------------------------------------------------------------------
// Mutations — role assignment
// ---------------------------------------------------------------------------

export const assignToUser = mutation({
  args: {
    userId: v.id('users'),
    roleId: v.id('roles'),
  },
  handler: async (ctx, args) => {
    const actorId = await requirePermission(ctx, 'roles:assign');

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error('Role not found');

    await ctx.db.patch(args.userId, {platformRoleId: args.roleId});

    await writeAuditLog(ctx, {
      actorId,
      action: 'roles:assign',
      targetType: 'users',
      targetId: args.userId,
      metadata: {roleName: role.name},
    });
  },
});

export const revokeFromUser = mutation({
  args: {userId: v.id('users')},
  handler: async (ctx, args) => {
    const actorId = await requirePermission(ctx, 'roles:assign');

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    const previousRoleId = user.platformRoleId;

    await ctx.db.patch(args.userId, {platformRoleId: undefined});

    await writeAuditLog(ctx, {
      actorId,
      action: 'roles:revoke',
      targetType: 'users',
      targetId: args.userId,
      metadata: previousRoleId ? {previousRoleId} : {},
    });
  },
});
