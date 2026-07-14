import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAuthenticatedUser } from "./lib/authz";

// FR-001a: Convex Auth's Password provider has no documented per-failed-attempt hook, and the
// client calls Convex Auth's own signIn("password", ...) action directly — there is no mutation
// of ours in that path to intercept. So lockout is a client-orchestrated check/record pair
// around that call (research.md §1, contracts/convex-api.md). Both functions run
// pre-authentication (a failed login leaves the caller unauthenticated), so neither requires an
// authenticated caller — they operate on the `users` row matched by email instead.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

export const checkLoginAllowed = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (user?.lockedUntil !== undefined && user.lockedUntil > Date.now()) {
      return { allowed: false, retryAfter: user.lockedUntil };
    }
    return { allowed: true };
  },
});

export const recordLoginResult = mutation({
  args: { email: v.string(), success: v.boolean() },
  handler: async (ctx, { email, success }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (user === null) return;

    if (success) {
      await ctx.db.patch(user._id, { failedLoginAttempts: 0, lockedUntil: undefined });
      return;
    }

    const failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
    const lockedUntil =
      failedLoginAttempts >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_MS : undefined;
    await ctx.db.patch(user._id, { failedLoginAttempts, lockedUntil });
  },
});

export const updateProfile = mutation({
  args: { displayName: v.optional(v.string()), avatarUrl: v.optional(v.string()) },
  handler: async (ctx, { displayName, avatarUrl }) => {
    const userId = await requireAuthenticatedUser(ctx);
    const patch: { displayName?: string; avatarUrl?: string } = {};
    if (displayName !== undefined) patch.displayName = displayName;
    if (avatarUrl !== undefined) patch.avatarUrl = avatarUrl;
    await ctx.db.patch(userId, patch);
  },
});

export const setStatus = mutation({
  args: { status: v.union(v.literal("online"), v.literal("invisible")) },
  handler: async (ctx, { status }) => {
    const userId = await requireAuthenticatedUser(ctx);
    await ctx.db.patch(userId, { status });
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return ctx.db.get(userId);
  },
});
