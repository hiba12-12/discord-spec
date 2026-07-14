import { mutation, query } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";
import { Presence } from "@convex-dev/presence";
import { requireServerMember, requireAuthenticatedUser } from "./lib/authz";

// research.md §2: thin wrapper around the official @convex-dev/presence component — no custom
// `presence` table. One presence "room" per serverId. Our own membership check is layered on
// top of the component's calls (FR-003: presence only visible to users who share a server).
const presence = new Presence(components.presence);

export const heartbeat = mutation({
  args: {
    roomId: v.string(), // serverId as a string
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
    const callerId = await requireAuthenticatedUser(ctx);
    if (callerId !== userId) {
      throw new Error("Cannot send a heartbeat on behalf of another user");
    }
    await requireServerMember(ctx, roomId as import("./_generated/dataModel").Id<"servers">);
    return presence.heartbeat(ctx, roomId, userId, sessionId, interval);
  },
});

export const list = query({
  args: { roomToken: v.string() },
  handler: async (ctx, { roomToken }) => {
    return presence.list(ctx, roomToken);
  },
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    return presence.disconnect(ctx, sessionToken);
  },
});
