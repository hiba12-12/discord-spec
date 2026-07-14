import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireChannelMember, requireMessageAuthor } from "./lib/authz";

const MAX_MESSAGE_LENGTH = 2000;

export const sendMessage = mutation({
  args: { channelId: v.id("channels"), content: v.string() },
  handler: async (ctx, { channelId, content }) => {
    const authorId = await requireChannelMember(ctx, channelId);
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer`);
    }
    return ctx.db.insert("messages", { channelId, authorId, content });
  },
});

export const editMessage = mutation({
  args: { messageId: v.id("messages"), content: v.string() },
  handler: async (ctx, { messageId, content }) => {
    await requireMessageAuthor(ctx, messageId);
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer`);
    }
    await ctx.db.patch(messageId, { content, editedAt: Date.now() });
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    await requireMessageAuthor(ctx, messageId);
    await ctx.db.delete(messageId);
  },
});

export const listMessages = query({
  args: { channelId: v.id("channels"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { channelId, paginationOpts }) => {
    await requireChannelMember(ctx, channelId);
    const page = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", channelId))
      .order("desc")
      .paginate(paginationOpts);

    const authorIds = [...new Set(page.page.map((m) => m.authorId))];
    const authors = await Promise.all(authorIds.map((id) => ctx.db.get(id)));
    const authorsById = new Map(authorIds.map((id, i) => [id, authors[i]]));

    return {
      ...page,
      page: page.page.map((message) => {
        const author = authorsById.get(message.authorId);
        return {
          ...message,
          authorDisplayName: author?.displayName ?? "Unknown User",
          authorAvatarUrl: author?.avatarUrl,
        };
      }),
    };
  },
});
