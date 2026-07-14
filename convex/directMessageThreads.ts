import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedUser, sharesAnyServer } from "./lib/authz";

export const openThread = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, { otherUserId }) => {
    const userId = await requireAuthenticatedUser(ctx);
    if (userId === otherUserId) {
      throw new Error("Cannot open a DM with yourself");
    }
    if (!(await sharesAnyServer(ctx, userId, otherUserId))) {
      throw new Error("You must share a server with this user to start a DM");
    }

    const [userAId, userBId] =
      userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];

    const existing = await ctx.db
      .query("directMessageThreads")
      .withIndex("by_pair", (q) => q.eq("userAId", userAId).eq("userBId", userBId))
      .unique();
    if (existing !== null) return existing._id;

    return ctx.db.insert("directMessageThreads", { userAId, userBId });
  },
});

export const listMyThreads = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthenticatedUser(ctx);
    const [asUserA, asUserB] = await Promise.all([
      ctx.db
        .query("directMessageThreads")
        .withIndex("by_userA", (q) => q.eq("userAId", userId))
        .collect(),
      ctx.db
        .query("directMessageThreads")
        .withIndex("by_userB", (q) => q.eq("userBId", userId))
        .collect(),
    ]);
    const threads = [...asUserA, ...asUserB];

    return Promise.all(
      threads.map(async (thread) => {
        const otherUserId = thread.userAId === userId ? thread.userBId : thread.userAId;
        const otherUser = await ctx.db.get(otherUserId);
        return {
          _id: thread._id,
          otherUserId,
          otherUserDisplayName: otherUser?.displayName ?? "Unknown User",
          otherUserAvatarUrl: otherUser?.avatarUrl,
        };
      }),
    );
  },
});
