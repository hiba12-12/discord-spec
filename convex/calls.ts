import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  requireCallParticipant,
  requireChannelMember,
  requireDmThreadParticipant,
  requireServerMember,
} from "./lib/authz";

const MAX_PARTICIPANTS = 4;
const STALE_HEARTBEAT_MS = 15_000;

const locationValidator = v.union(
  v.object({ kind: v.literal("voiceChannel"), channelId: v.id("channels") }),
  v.object({ kind: v.literal("dm"), threadId: v.id("directMessageThreads") }),
);

type Location =
  | { kind: "voiceChannel"; channelId: Id<"channels"> }
  | { kind: "dm"; threadId: Id<"directMessageThreads"> };

async function requireLocationAccess(
  ctx: QueryCtx | MutationCtx,
  location: Location,
): Promise<Id<"users">> {
  if (location.kind === "voiceChannel") {
    return requireChannelMember(ctx, location.channelId);
  }
  return requireDmThreadParticipant(ctx, location.threadId);
}

async function findCallForLocation(ctx: QueryCtx | MutationCtx, location: Location) {
  if (location.kind === "voiceChannel") {
    return ctx.db
      .query("calls")
      .withIndex("by_voice_channel", (q) =>
        q.eq("location.kind", "voiceChannel").eq("location.channelId", location.channelId),
      )
      .unique();
  }
  return ctx.db
    .query("calls")
    .withIndex("by_dm_thread", (q) =>
      q.eq("location.kind", "dm").eq("location.threadId", location.threadId),
    )
    .unique();
}

export const joinCall = mutation({
  args: { location: locationValidator },
  handler: async (ctx, { location }) => {
    const userId = await requireLocationAccess(ctx, location);

    let call = await findCallForLocation(ctx, location);
    if (call === null) {
      const callId = await ctx.db.insert("calls", { location, startedAt: Date.now() });
      call = await ctx.db.get(callId);
    }
    if (call === null) throw new Error("Failed to create call");

    const existingParticipant = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_and_user", (q) => q.eq("callId", call!._id).eq("userId", userId))
      .unique();
    if (existingParticipant !== null) return call._id;

    const participantCount = (
      await ctx.db
        .query("callParticipants")
        .withIndex("by_call", (q) => q.eq("callId", call!._id))
        .collect()
    ).length;
    if (participantCount >= MAX_PARTICIPANTS) {
      throw new Error("This call is full");
    }

    await ctx.db.insert("callParticipants", {
      callId: call._id,
      userId,
      micOn: true,
      cameraOn: false,
      isSpeaking: false,
      lastHeartbeatAt: Date.now(),
    });

    return call._id;
  },
});

export const leaveCall = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const userId = await requireCallParticipant(ctx, callId);

    const participant = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_and_user", (q) => q.eq("callId", callId).eq("userId", userId))
      .unique();
    if (participant !== null) {
      await ctx.db.delete(participant._id);
    }

    const pendingSignals = await ctx.db
      .query("signals")
      .withIndex("by_call_and_recipient", (q) => q.eq("callId", callId))
      .collect();
    await Promise.all(
      pendingSignals
        .filter((s) => s.fromUserId === userId || s.toUserId === userId)
        .map((s) => ctx.db.delete(s._id)),
    );

    const remaining = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .collect();
    if (remaining.length === 0) {
      await ctx.db.delete(callId);
    }
  },
});

export const updateParticipantState = mutation({
  args: {
    callId: v.id("calls"),
    micOn: v.optional(v.boolean()),
    cameraOn: v.optional(v.boolean()),
    isSpeaking: v.optional(v.boolean()),
  },
  handler: async (ctx, { callId, micOn, cameraOn, isSpeaking }) => {
    const userId = await requireCallParticipant(ctx, callId);
    const participant = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_and_user", (q) => q.eq("callId", callId).eq("userId", userId))
      .unique();
    if (participant === null) throw new Error("Not a participant in this call");

    const patch: { micOn?: boolean; cameraOn?: boolean; isSpeaking?: boolean } = {};
    if (micOn !== undefined) patch.micOn = micOn;
    if (cameraOn !== undefined) patch.cameraOn = cameraOn;
    if (isSpeaking !== undefined) patch.isSpeaking = isSpeaking;
    await ctx.db.patch(participant._id, patch);
  },
});

export const callHeartbeat = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const userId = await requireCallParticipant(ctx, callId);
    const participant = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_and_user", (q) => q.eq("callId", callId).eq("userId", userId))
      .unique();
    if (participant === null) throw new Error("Not a participant in this call");
    await ctx.db.patch(participant._id, { lastHeartbeatAt: Date.now() });
  },
});

export const listParticipants = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    await requireCallParticipant(ctx, callId);
    const participants = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .collect();

    return Promise.all(
      participants.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        return {
          userId: p.userId,
          micOn: p.micOn,
          cameraOn: p.cameraOn,
          isSpeaking: p.isSpeaking,
          displayName: user?.displayName ?? "Unknown User",
          avatarUrl: user?.avatarUrl,
        };
      }),
    );
  },
});

export const getActiveCallForDmThread = query({
  args: { threadId: v.id("directMessageThreads") },
  handler: async (ctx, { threadId }) => {
    await requireDmThreadParticipant(ctx, threadId);
    const call = await ctx.db
      .query("calls")
      .withIndex("by_dm_thread", (q) => q.eq("location.kind", "dm").eq("location.threadId", threadId))
      .unique();
    if (call === null) return null;

    const participants = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", call._id))
      .collect();
    return {
      callId: call._id,
      participantUserIds: participants.map((p) => p.userId),
    };
  },
});

export const listActiveCallsForServer = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    await requireServerMember(ctx, serverId);
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_server_and_type", (q) => q.eq("serverId", serverId).eq("type", "voice"))
      .collect();

    const result: Record<string, Id<"users">[]> = {};
    await Promise.all(
      channels.map(async (channel) => {
        const call = await ctx.db
          .query("calls")
          .withIndex("by_voice_channel", (q) =>
            q.eq("location.kind", "voiceChannel").eq("location.channelId", channel._id),
          )
          .unique();
        if (call === null) return;
        const participants = await ctx.db
          .query("callParticipants")
          .withIndex("by_call", (q) => q.eq("callId", call._id))
          .collect();
        result[channel._id] = participants.map((p) => p.userId);
      }),
    );
    return result;
  },
});

export const sweepStaleCallParticipants = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STALE_HEARTBEAT_MS;
    const staleParticipants = await ctx.db
      .query("callParticipants")
      .filter((q) => q.lt(q.field("lastHeartbeatAt"), cutoff))
      .collect();

    const affectedCallIds = new Set<Id<"calls">>();
    for (const participant of staleParticipants) {
      affectedCallIds.add(participant.callId);
      await ctx.db.delete(participant._id);
    }

    for (const callId of affectedCallIds) {
      const remaining = await ctx.db
        .query("callParticipants")
        .withIndex("by_call", (q) => q.eq("callId", callId))
        .collect();
      if (remaining.length === 0) {
        await ctx.db.delete(callId);
      }
    }
  },
});

// Exported for use by channels.ts's deleteChannel cascade.
export async function endCallForVoiceChannel(
  ctx: MutationCtx,
  channelId: Id<"channels">,
): Promise<void> {
  const call = await ctx.db
    .query("calls")
    .withIndex("by_voice_channel", (q) =>
      q.eq("location.kind", "voiceChannel").eq("location.channelId", channelId),
    )
    .unique();
  if (call === null) return;
  const participants = await ctx.db
    .query("callParticipants")
    .withIndex("by_call", (q) => q.eq("callId", call._id))
    .collect();
  await Promise.all(participants.map((p) => ctx.db.delete(p._id)));
  await ctx.db.delete(call._id);
}
