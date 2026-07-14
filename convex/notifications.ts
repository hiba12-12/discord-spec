import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedUser } from "./lib/authz";
import { listServerIdsForUser } from "./serverMembers";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type Scope =
  | { kind: "channel"; serverId: Id<"servers">; serverName: string; channelId: Id<"channels">; channelName: string }
  | { kind: "dm"; threadId: Id<"directMessageThreads">; otherUserDisplayName: string };

interface ActivityEvent {
  key: string;
  type: "message" | "call";
  scope: Scope;
  authorDisplayName: string;
  preview?: string;
  createdAt: number;
}

async function listMyThreadsRaw(ctx: QueryCtx, userId: Id<"users">) {
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
  return [...asUserA, ...asUserB];
}

export const listMyRecentActivity = query({
  args: { since: v.number() },
  handler: async (ctx, { since }): Promise<ActivityEvent[]> => {
    const userId = await requireAuthenticatedUser(ctx);
    const events: ActivityEvent[] = [];

    const serverIds = await listServerIdsForUser(ctx, userId);
    for (const serverId of serverIds) {
      const server = await ctx.db.get(serverId);
      if (server === null) continue;
      const channels = await ctx.db
        .query("channels")
        .withIndex("by_server", (q) => q.eq("serverId", serverId))
        .collect();

      for (const channel of channels) {
        if (channel.type === "text") {
          const latest = await ctx.db
            .query("messages")
            .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
            .order("desc")
            .first();
          if (latest !== null && latest._creationTime > since && latest.authorId !== userId) {
            const author = await ctx.db.get(latest.authorId);
            events.push({
              key: `msg:${latest._id}`,
              type: "message",
              scope: {
                kind: "channel",
                serverId,
                serverName: server.name,
                channelId: channel._id,
                channelName: channel.name,
              },
              authorDisplayName: author?.displayName ?? "Someone",
              preview: latest.content.slice(0, 80),
              createdAt: latest._creationTime,
            });
          }
        } else {
          const call = await ctx.db
            .query("calls")
            .withIndex("by_voice_channel", (q) =>
              q.eq("location.kind", "voiceChannel").eq("location.channelId", channel._id),
            )
            .unique();
          if (call !== null && call.startedAt > since) {
            const amParticipant = await ctx.db
              .query("callParticipants")
              .withIndex("by_call_and_user", (q) => q.eq("callId", call._id).eq("userId", userId))
              .unique();
            if (amParticipant === null) {
              events.push({
                key: `call:${call._id}`,
                type: "call",
                scope: {
                  kind: "channel",
                  serverId,
                  serverName: server.name,
                  channelId: channel._id,
                  channelName: channel.name,
                },
                authorDisplayName: server.name,
                createdAt: call.startedAt,
              });
            }
          }
        }
      }
    }

    const threads = await listMyThreadsRaw(ctx, userId);
    for (const thread of threads) {
      const otherUserId = thread.userAId === userId ? thread.userBId : thread.userAId;
      const otherUser = await ctx.db.get(otherUserId);
      const otherUserDisplayName = otherUser?.displayName ?? "Someone";

      const latestDm = await ctx.db
        .query("directMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .order("desc")
        .first();
      if (latestDm !== null && latestDm._creationTime > since && latestDm.authorId !== userId) {
        events.push({
          key: `dm:${latestDm._id}`,
          type: "message",
          scope: { kind: "dm", threadId: thread._id, otherUserDisplayName },
          authorDisplayName: otherUserDisplayName,
          preview: latestDm.content.slice(0, 80),
          createdAt: latestDm._creationTime,
        });
      }

      const call = await ctx.db
        .query("calls")
        .withIndex("by_dm_thread", (q) =>
          q.eq("location.kind", "dm").eq("location.threadId", thread._id),
        )
        .unique();
      if (call !== null && call.startedAt > since) {
        const amParticipant = await ctx.db
          .query("callParticipants")
          .withIndex("by_call_and_user", (q) => q.eq("callId", call._id).eq("userId", userId))
          .unique();
        if (amParticipant === null) {
          events.push({
            key: `call:${call._id}`,
            type: "call",
            scope: { kind: "dm", threadId: thread._id, otherUserDisplayName },
            authorDisplayName: otherUserDisplayName,
            createdAt: call.startedAt,
          });
        }
      }
    }

    return events.sort((a, b) => a.createdAt - b.createdAt);
  },
});
