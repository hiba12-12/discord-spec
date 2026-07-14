import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // Overrides authTables' default `users` table with our extended fields
  // (research.md §1 — this IS the Convex Auth identity table, not a joined profile table).
  users: defineTable({
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    failedLoginAttempts: v.optional(v.number()),
    lockedUntil: v.optional(v.number()),
    // User-controlled visibility override — undefined/"online" means the real presence/heartbeat
    // state is shown as-is; "invisible" means other users always see this user as offline
    // regardless of an active connection (the user still sees their own real state).
    status: v.optional(v.union(v.literal("online"), v.literal("invisible"))),
  }).index("email", ["email"]),

  servers: defineTable({
    name: v.string(),
    imageUrl: v.optional(v.string()),
    ownerId: v.id("users"),
    inviteCode: v.string(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_inviteCode", ["inviteCode"]),

  serverMembers: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    joinedAt: v.number(),
  })
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"])
    .index("by_server_and_user", ["serverId", "userId"]),

  channels: defineTable({
    serverId: v.id("servers"),
    name: v.string(),
    type: v.union(v.literal("text"), v.literal("voice")),
  })
    .index("by_server", ["serverId"])
    .index("by_server_and_type", ["serverId", "type"]),

  messages: defineTable({
    channelId: v.id("channels"),
    authorId: v.id("users"),
    content: v.string(),
    editedAt: v.optional(v.number()),
  }).index("by_channel", ["channelId"]),

  directMessageThreads: defineTable({
    userAId: v.id("users"), // canonically the lexicographically-smaller of the two IDs
    userBId: v.id("users"), // canonically the larger of the two IDs
  })
    .index("by_pair", ["userAId", "userBId"])
    .index("by_userA", ["userAId"])
    .index("by_userB", ["userBId"]),

  directMessages: defineTable({
    threadId: v.id("directMessageThreads"),
    authorId: v.id("users"),
    content: v.string(),
    editedAt: v.optional(v.number()),
  }).index("by_thread", ["threadId"]),

  typingIndicators: defineTable({
    scope: v.union(
      v.object({ kind: v.literal("channel"), channelId: v.id("channels") }),
      v.object({ kind: v.literal("thread"), threadId: v.id("directMessageThreads") }),
    ),
    userId: v.id("users"),
    lastTypedAt: v.number(),
  })
    .index("by_channel_scope", ["scope.kind", "scope.channelId", "userId"])
    .index("by_thread_scope", ["scope.kind", "scope.threadId", "userId"]),

  calls: defineTable({
    location: v.union(
      v.object({ kind: v.literal("voiceChannel"), channelId: v.id("channels") }),
      v.object({ kind: v.literal("dm"), threadId: v.id("directMessageThreads") }),
    ),
    startedAt: v.number(),
  })
    .index("by_voice_channel", ["location.kind", "location.channelId"])
    .index("by_dm_thread", ["location.kind", "location.threadId"]),

  callParticipants: defineTable({
    callId: v.id("calls"),
    userId: v.id("users"),
    micOn: v.boolean(),
    cameraOn: v.boolean(),
    isSpeaking: v.boolean(),
    lastHeartbeatAt: v.number(),
  })
    .index("by_call", ["callId"])
    .index("by_call_and_user", ["callId", "userId"]),

  signals: defineTable({
    callId: v.id("calls"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice-candidate")),
    payload: v.string(),
  }).index("by_call_and_recipient", ["callId", "toUserId"]),
});
