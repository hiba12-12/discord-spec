import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireDirectMessageAuthor, requireDmThreadParticipant } from "./lib/authz";

const MAX_MESSAGE_LENGTH = 2000;

export const sendDirectMessage = mutation({
  args: { threadId: v.id("directMessageThreads"), content: v.string() },
  handler: async (ctx, { threadId, content }) => {
    const authorId = await requireDmThreadParticipant(ctx, threadId);
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer`);
    }
    return ctx.db.insert("directMessages", { threadId, authorId, content });
  },
});

export const editDirectMessage = mutation({
  args: { messageId: v.id("directMessages"), content: v.string() },
  handler: async (ctx, { messageId, content }) => {
    await requireDirectMessageAuthor(ctx, messageId);
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer`);
    }
    await ctx.db.patch(messageId, { content, editedAt: Date.now() });
  },
});

export const deleteDirectMessage = mutation({
  args: { messageId: v.id("directMessages") },
  handler: async (ctx, { messageId }) => {
    await requireDirectMessageAuthor(ctx, messageId);
    await ctx.db.delete(messageId);
  },
});

export const listDirectMessages = query({
  args: { threadId: v.id("directMessageThreads"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { threadId, paginationOpts }) => {
    await requireDmThreadParticipant(ctx, threadId);
    const page = await ctx.db
      .query("directMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
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
