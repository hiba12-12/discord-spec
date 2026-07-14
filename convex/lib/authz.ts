import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

/** Every convex/*.ts query/mutation touching a server/channel/message/DM/call MUST go through
 * one of these helpers (constitution Principle IV — Security Basics: auth/authz checked
 * server-side, inside the function itself, never assumed from the UI). */

export async function requireAuthenticatedUser(ctx: Ctx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Not authenticated");
  }
  return userId;
}

export async function requireServerMember(
  ctx: Ctx,
  serverId: Id<"servers">,
): Promise<Id<"users">> {
  const userId = await requireAuthenticatedUser(ctx);
  const membership = await ctx.db
    .query("serverMembers")
    .withIndex("by_server_and_user", (q) => q.eq("serverId", serverId).eq("userId", userId))
    .unique();
  if (membership === null) {
    throw new Error("Not a member of this server");
  }
  return userId;
}

export async function requireServerOwner(
  ctx: Ctx,
  serverId: Id<"servers">,
): Promise<Id<"users">> {
  const userId = await requireAuthenticatedUser(ctx);
  const server = await ctx.db.get(serverId);
  if (server === null || server.ownerId !== userId) {
    throw new Error("Only the server owner can perform this action");
  }
  return userId;
}

export async function requireChannelMember(
  ctx: Ctx,
  channelId: Id<"channels">,
): Promise<Id<"users">> {
  const channel = await ctx.db.get(channelId);
  if (channel === null) {
    throw new Error("Channel not found");
  }
  return requireServerMember(ctx, channel.serverId);
}

export async function requireMessageAuthor(
  ctx: Ctx,
  messageId: Id<"messages">,
): Promise<Id<"users">> {
  const userId = await requireAuthenticatedUser(ctx);
  const message = await ctx.db.get(messageId);
  if (message === null || message.authorId !== userId) {
    throw new Error("Only the message's author can perform this action");
  }
  return userId;
}

export async function requireDirectMessageAuthor(
  ctx: Ctx,
  messageId: Id<"directMessages">,
): Promise<Id<"users">> {
  const userId = await requireAuthenticatedUser(ctx);
  const message = await ctx.db.get(messageId);
  if (message === null || message.authorId !== userId) {
    throw new Error("Only the message's author can perform this action");
  }
  return userId;
}

export async function requireDmThreadParticipant(
  ctx: Ctx,
  threadId: Id<"directMessageThreads">,
): Promise<Id<"users">> {
  const userId = await requireAuthenticatedUser(ctx);
  const thread = await ctx.db.get(threadId);
  if (thread === null || (thread.userAId !== userId && thread.userBId !== userId)) {
    throw new Error("Not a participant in this DM thread");
  }
  return userId;
}

export async function requireCallParticipant(
  ctx: Ctx,
  callId: Id<"calls">,
): Promise<Id<"users">> {
  const userId = await requireAuthenticatedUser(ctx);
  const participant = await ctx.db
    .query("callParticipants")
    .withIndex("by_call_and_user", (q) => q.eq("callId", callId).eq("userId", userId))
    .unique();
  if (participant === null) {
    throw new Error("Not a participant in this call");
  }
  return userId;
}

export async function sharesAnyServer(
  ctx: Ctx,
  userAId: Id<"users">,
  userBId: Id<"users">,
): Promise<boolean> {
  const aServers = await ctx.db
    .query("serverMembers")
    .withIndex("by_user", (q) => q.eq("userId", userAId))
    .collect();
  const aServerIds = new Set(aServers.map((m) => m.serverId));
  const bServers = await ctx.db
    .query("serverMembers")
    .withIndex("by_user", (q) => q.eq("userId", userBId))
    .collect();
  return bServers.some((m) => aServerIds.has(m.serverId));
}
