import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/** Membership helpers shared by servers.ts (getServer) and lib/authz.ts. Not exposed as public
 * Convex functions themselves — contracts/convex-api.md only documents the public queries/
 * mutations in servers.ts that use these. */

export async function listServerMembersWithProfiles(
  ctx: QueryCtx | MutationCtx,
  serverId: Id<"servers">,
) {
  const memberships = await ctx.db
    .query("serverMembers")
    .withIndex("by_server", (q) => q.eq("serverId", serverId))
    .collect();

  return Promise.all(
    memberships.map(async (membership) => {
      const user = await ctx.db.get(membership.userId);
      return {
        userId: membership.userId,
        joinedAt: membership.joinedAt,
        displayName: user?.displayName ?? "Unknown User",
        avatarUrl: user?.avatarUrl,
        status: user?.status ?? "online",
      };
    }),
  );
}

export async function listServerIdsForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Id<"servers">[]> {
  const memberships = await ctx.db
    .query("serverMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return memberships.map((m) => m.serverId);
}

export async function isServerMember(
  ctx: QueryCtx | MutationCtx,
  serverId: Id<"servers">,
  userId: Id<"users">,
): Promise<boolean> {
  const membership = await ctx.db
    .query("serverMembers")
    .withIndex("by_server_and_user", (q) => q.eq("serverId", serverId).eq("userId", userId))
    .unique();
  return membership !== null;
}
