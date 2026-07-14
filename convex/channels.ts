import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServerMember, requireServerOwner } from "./lib/authz";
import { endCallForVoiceChannel } from "./calls";

export const listChannels = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    await requireServerMember(ctx, serverId);
    return ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect();
  },
});

export const createChannel = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.string(),
    type: v.union(v.literal("text"), v.literal("voice")),
  },
  handler: async (ctx, { serverId, name, type }) => {
    await requireServerOwner(ctx, serverId);
    return ctx.db.insert("channels", { serverId, name, type });
  },
});

export const renameChannel = mutation({
  args: { channelId: v.id("channels"), name: v.string() },
  handler: async (ctx, { channelId, name }) => {
    const channel = await ctx.db.get(channelId);
    if (channel === null) throw new Error("Channel not found");
    await requireServerOwner(ctx, channel.serverId);
    await ctx.db.patch(channelId, { name });
  },
});

export const deleteChannel = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, { channelId }) => {
    const channel = await ctx.db.get(channelId);
    if (channel === null) throw new Error("Channel not found");
    await requireServerOwner(ctx, channel.serverId);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", channelId))
      .collect();
    await Promise.all(messages.map((message) => ctx.db.delete(message._id)));

    if (channel.type === "voice") {
      await endCallForVoiceChannel(ctx, channelId);
    }

    await ctx.db.delete(channelId);
  },
});
