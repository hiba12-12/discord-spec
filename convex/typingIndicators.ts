import { internalMutation, mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireChannelMember, requireDmThreadParticipant } from "./lib/authz";

const FRESHNESS_WINDOW_MS = 5_000;

const scopeValidator = v.union(
  v.object({ kind: v.literal("channel"), channelId: v.id("channels") }),
  v.object({ kind: v.literal("thread"), threadId: v.id("directMessageThreads") }),
);

type Scope =
  | { kind: "channel"; channelId: Id<"channels"> }
  | { kind: "thread"; threadId: Id<"directMessageThreads"> };

async function requireScopeAccess(ctx: QueryCtx | MutationCtx, scope: Scope): Promise<Id<"users">> {
  if (scope.kind === "channel") {
    return requireChannelMember(ctx, scope.channelId);
  }
  return requireDmThreadParticipant(ctx, scope.threadId);
}

async function findExistingRow(ctx: QueryCtx | MutationCtx, scope: Scope, userId: Id<"users">) {
  if (scope.kind === "channel") {
    return ctx.db
      .query("typingIndicators")
      .withIndex("by_channel_scope", (q) =>
        q.eq("scope.kind", "channel").eq("scope.channelId", scope.channelId).eq("userId", userId),
      )
      .unique();
  }
  return ctx.db
    .query("typingIndicators")
    .withIndex("by_thread_scope", (q) =>
      q.eq("scope.kind", "thread").eq("scope.threadId", scope.threadId).eq("userId", userId),
    )
    .unique();
}

export const setTyping = mutation({
  args: { scope: scopeValidator },
  handler: async (ctx, { scope }) => {
    const userId = await requireScopeAccess(ctx, scope);
    const existing = await findExistingRow(ctx, scope, userId);
    if (existing !== null) {
      await ctx.db.patch(existing._id, { lastTypedAt: Date.now() });
    } else {
      await ctx.db.insert("typingIndicators", { scope, userId, lastTypedAt: Date.now() });
    }
  },
});

export const clearTyping = mutation({
  args: { scope: scopeValidator },
  handler: async (ctx, { scope }) => {
    const userId = await requireScopeAccess(ctx, scope);
    const existing = await findExistingRow(ctx, scope, userId);
    if (existing !== null) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const listTypingUsers = query({
  args: { scope: scopeValidator },
  handler: async (ctx, { scope }) => {
    const callerId = await requireScopeAccess(ctx, scope);
    const rows =
      scope.kind === "channel"
        ? await ctx.db
            .query("typingIndicators")
            .withIndex("by_channel_scope", (q) =>
              q.eq("scope.kind", "channel").eq("scope.channelId", scope.channelId),
            )
            .collect()
        : await ctx.db
            .query("typingIndicators")
            .withIndex("by_thread_scope", (q) =>
              q.eq("scope.kind", "thread").eq("scope.threadId", scope.threadId),
            )
            .collect();

    const cutoff = Date.now() - FRESHNESS_WINDOW_MS;
    const freshRows = rows.filter((row) => row.lastTypedAt >= cutoff && row.userId !== callerId);

    const users = await Promise.all(freshRows.map((row) => ctx.db.get(row.userId)));
    return freshRows.map((row, i) => ({
      userId: row.userId,
      displayName: users[i]?.displayName ?? "Unknown User",
    }));
  },
});

export const sweepStaleTyping = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - FRESHNESS_WINDOW_MS;
    const rows = await ctx.db.query("typingIndicators").collect();
    await Promise.all(
      rows.filter((row) => row.lastTypedAt < cutoff).map((row) => ctx.db.delete(row._id)),
    );
  },
});
