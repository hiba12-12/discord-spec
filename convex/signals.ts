import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireCallParticipant } from "./lib/authz";

export const sendSignal = mutation({
  args: {
    callId: v.id("calls"),
    toUserId: v.id("users"),
    type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice-candidate")),
    payload: v.string(),
  },
  handler: async (ctx, { callId, toUserId, type, payload }) => {
    const fromUserId = await requireCallParticipant(ctx, callId);

    const recipient = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_and_user", (q) => q.eq("callId", callId).eq("userId", toUserId))
      .unique();
    if (recipient === null) {
      throw new Error("Recipient is not a participant in this call");
    }

    await ctx.db.insert("signals", { callId, fromUserId, toUserId, type, payload });
  },
});

export const listSignalsForMe = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const userId = await requireCallParticipant(ctx, callId);
    const signals = await ctx.db
      .query("signals")
      .withIndex("by_call_and_recipient", (q) => q.eq("callId", callId).eq("toUserId", userId))
      .collect();
    return signals.sort((a, b) => a._creationTime - b._creationTime);
  },
});

export const consumeSignal = mutation({
  args: { signalId: v.id("signals") },
  handler: async (ctx, { signalId }) => {
    const signal = await ctx.db.get(signalId);
    if (signal === null) return;
    const userId = await requireCallParticipant(ctx, signal.callId);
    if (signal.toUserId !== userId) {
      throw new Error("Only the signal's recipient can consume it");
    }
    await ctx.db.delete(signalId);
  },
});
