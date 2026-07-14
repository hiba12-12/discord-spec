import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedUser, requireServerMember, requireServerOwner } from "./lib/authz";
import { listServerMembersWithProfiles, listServerIdsForUser } from "./serverMembers";

function generateInviteCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export const createServer = mutation({
  args: { name: v.string(), imageUrl: v.optional(v.string()) },
  handler: async (ctx, { name, imageUrl }) => {
    const ownerId = await requireAuthenticatedUser(ctx);

    const serverId = await ctx.db.insert("servers", {
      name,
      imageUrl,
      ownerId,
      inviteCode: generateInviteCode(),
    });

    await ctx.db.insert("serverMembers", {
      serverId,
      userId: ownerId,
      joinedAt: Date.now(),
    });

    await ctx.db.insert("channels", {
      serverId,
      name: "general",
      type: "text",
    });

    return serverId;
  },
});

export const listMyServers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthenticatedUser(ctx);
    const serverIds = await listServerIdsForUser(ctx, userId);
    const servers = await Promise.all(serverIds.map((id) => ctx.db.get(id)));
    return servers.filter((s) => s !== null);
  },
});

export const getServer = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    await requireServerMember(ctx, serverId);
    const server = await ctx.db.get(serverId);
    if (server === null) throw new Error("Server not found");
    const members = await listServerMembersWithProfiles(ctx, serverId);
    return { server, members };
  },
});

export const renameServer = mutation({
  args: { serverId: v.id("servers"), name: v.string() },
  handler: async (ctx, { serverId, name }) => {
    await requireServerOwner(ctx, serverId);
    await ctx.db.patch(serverId, { name });
  },
});

export const regenerateInvite = mutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    await requireServerOwner(ctx, serverId);
    const inviteCode = generateInviteCode();
    await ctx.db.patch(serverId, { inviteCode });
    return inviteCode;
  },
});

export const joinByInvite = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, { inviteCode }) => {
    const userId = await requireAuthenticatedUser(ctx);

    const server = await ctx.db
      .query("servers")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", inviteCode))
      .unique();
    if (server === null) {
      throw new Error("This invite link is invalid or has expired");
    }

    const existingMembership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", server._id).eq("userId", userId),
      )
      .unique();
    if (existingMembership === null) {
      await ctx.db.insert("serverMembers", {
        serverId: server._id,
        userId,
        joinedAt: Date.now(),
      });
    }

    return server._id;
  },
});

export const removeMember = mutation({
  args: { serverId: v.id("servers"), userId: v.id("users") },
  handler: async (ctx, { serverId, userId }) => {
    await requireServerOwner(ctx, serverId);

    const server = await ctx.db.get(serverId);
    if (server === null) throw new Error("Server not found");
    if (server.ownerId === userId) {
      throw new Error("The server owner cannot be removed");
    }

    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_and_user", (q) => q.eq("serverId", serverId).eq("userId", userId))
      .unique();
    if (membership === null) {
      throw new Error("That user is not a member of this server");
    }
    await ctx.db.delete(membership._id);
  },
});
