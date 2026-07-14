# Phase 1 Data Model: Real-Time Chat & Video Calling Application

All tables are defined in `convex/schema.ts` via `defineSchema`/`defineTable`. Every table listed
below includes the indexes required by its access patterns (constitution III: typed schema is
the only path to data; no untyped queries).

## users

**This table IS the Convex Auth identity table** (`authTables.users`, inlined and extended in
`convex/schema.ts` — not a separate app table joined to auth by a foreign key). Convex Auth links
its own `authAccounts` table to this one internally; there is no `authId` field on `users` itself
(research.md §1, verified 2026-07-14 — corrects the original draft, which mistakenly modeled this
as a separate table with an `authId` pointer).

| Field | Type | Notes |
|---|---|---|
| `email` | `string \| undefined` | Managed by Convex Auth |
| `emailVerificationTime` | `number \| undefined` | Managed by Convex Auth |
| `isAnonymous` | `boolean \| undefined` | Managed by Convex Auth |
| `displayName` | `string` | App field, set via the Password provider's `profile` callback at signup; not unique (Clarification 2026-07-14) |
| `avatarUrl` | `string \| undefined` | App field; optional, default placeholder rendered client-side if absent |
| `failedLoginAttempts` | `number` | App field, for FR-001a rate limiting (see contracts/convex-api.md for how this is enforced — Convex Auth's Password provider has no documented per-attempt failure hook, so this is enforced by a client-called check/record pair around `signIn`, not inside Convex Auth's own action) |
| `lockedUntil` | `number \| undefined` | App field; Unix ms timestamp, login rejected while in the future |

**Indexes**: `email` (Convex Auth's own index, used for its account lookup).

## presence

**No custom table** — presence is handled entirely by the official `@convex-dev/presence`
component (research.md §2, verified 2026-07-14), which manages its own internal storage outside
`convex/schema.ts`. Our code only adds thin wrapper functions in `convex/presence.ts`
(`heartbeat`, `list`, `disconnect`) that delegate to the component and layer our own
server-membership authorization check on top (FR-003: presence is only visible to users who
share a server). One presence "room" per `serverId`.

## servers

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | |
| `imageUrl` | `string \| undefined` | Optional |
| `ownerId` | `Id<"users">` | |
| `inviteCode` | `string` | Reusable, non-expiring (Assumptions); regenerable by owner |

**Indexes**: `by_ownerId` (servers a user owns); `by_inviteCode` (unique — invite-link lookup on join).

## serverMembers

| Field | Type | Notes |
|---|---|---|
| `serverId` | `Id<"servers">` | |
| `userId` | `Id<"users">` | |
| `joinedAt` | `number` | |

**Indexes**: `by_server` (list members of a server); `by_user` (list servers a user belongs to);
`by_server_and_user` (unique — fast membership check, used by every authz helper).

## channels

| Field | Type | Notes |
|---|---|---|
| `serverId` | `Id<"servers">` | |
| `name` | `string` | |
| `type` | `"text" \| "voice"` | |

**Indexes**: `by_server` (list a server's channels); `by_server_and_type` (list only voice channels
for the call-roster view).

## messages

| Field | Type | Notes |
|---|---|---|
| `channelId` | `Id<"channels">` | Only valid for `type: "text"` channels |
| `authorId` | `Id<"users">` | |
| `content` | `string` | Max 2,000 chars (Clarification 2026-07-14), enforced in the mutation |
| `editedAt` | `number \| undefined` | Present ⇒ render "(edited)" |

**Indexes**: `by_channel` ordered by `_creationTime` (paginated newest-first per FR-021).

**Lifecycle**: Deleting a channel deletes all its messages (FR-013) — implemented as a mutation
that batch-deletes by the `by_channel` index before deleting the channel document.

## directMessageThreads

| Field | Type | Notes |
|---|---|---|
| `userAId` | `Id<"users">` | Canonically the lexicographically-smaller of the two IDs |
| `userBId` | `Id<"users">` | Canonically the larger of the two IDs |

**Indexes**: `by_pair` (unique on `[userAId, userBId]` — find-or-create lookup); `by_userA` and
`by_userB` (list "my DM threads" from either side of the pair).

**Invariant**: Creation only permitted (FR-023) if `userAId` and `userBId` share at least one
`serverMembers` row for a common `serverId` — checked in the `openThread` mutation.

## directMessages

| Field | Type | Notes |
|---|---|---|
| `threadId` | `Id<"directMessageThreads">` | |
| `authorId` | `Id<"users">` | |
| `content` | `string` | Same 2,000-char cap as channel messages |
| `editedAt` | `number \| undefined` | |

**Indexes**: `by_thread` ordered by `_creationTime` (same pagination pattern as `messages`).

## typingIndicators

| Field | Type | Notes |
|---|---|---|
| `scope` | `{ kind: "channel"; channelId: Id<"channels"> } \| { kind: "thread"; threadId: Id<"directMessageThreads"> }` | |
| `userId` | `Id<"users">` | |
| `lastTypedAt` | `number` | Unix ms |

**Indexes**: `by_channel_scope` and `by_thread_scope` (both unique on `[scope, userId]` — upsert
target); readers filter client-side/query-side to rows within the last 5s (research.md §3).

## calls

| Field | Type | Notes |
|---|---|---|
| `location` | `{ kind: "voiceChannel"; channelId: Id<"channels"> } \| { kind: "dm"; threadId: Id<"directMessageThreads"> }` | |
| `startedAt` | `number` | |

**Indexes**: `by_voice_channel` (unique — at most one active call per voice channel); `by_dm_thread`
(unique — at most one active call per DM thread). A call document is deleted when its last
participant leaves (FR-030).

## callParticipants

| Field | Type | Notes |
|---|---|---|
| `callId` | `Id<"calls">` | |
| `userId` | `Id<"users">` | |
| `micOn` | `boolean` | |
| `cameraOn` | `boolean` | |
| `isSpeaking` | `boolean` | Updated client-side via audio-level detection, written on change |
| `lastHeartbeatAt` | `number` | Unix ms; updated by a `callHeartbeat` mutation on a ~5s interval while connected to the call (closes the gap identified in the plan audit: without this, a dropped/crashed client leaves a phantom participant row forever, permanently occupying a slot toward the 4-participant cap, FR-026) |

**Indexes**: `by_call` (roster query, and count check enforcing the 4-participant cap in the
`joinCall` mutation, FR-026); `by_call_and_user` (unique — prevents duplicate join rows, fast
leave lookup).

**Lifecycle**: A scheduled `sweepStaleCallParticipants` function (analogous to the presence
component's own staleness handling, but scoped to calls) runs every ~10s and deletes any
`callParticipants` row whose `lastHeartbeatAt` is older than ~15s (3 missed heartbeats), then
deletes the parent `calls` row if it has no participants left — this is the mechanism satisfying
the spec's Edge Case "what happens when a member's connection drops mid-call" (spec.md line 119),
which had no corresponding data/lifecycle before this update.

## signals

| Field | Type | Notes |
|---|---|---|
| `callId` | `Id<"calls">` | |
| `fromUserId` | `Id<"users">` | |
| `toUserId` | `Id<"users">` | |
| `type` | `"offer" \| "answer" \| "ice-candidate"` | |
| `payload` | `string` | JSON-serialized SDP or ICE candidate |

**Indexes**: `by_call_and_recipient` (the addressee's `useQuery` subscription). Rows are deleted
by a `consumeSignal` mutation immediately after the client applies them, keeping the table small
(research.md §4).

## Entity Relationship Summary

```text
users ─┬─< serverMembers >─ servers ─< channels ─< messages
       ├─< directMessageThreads (as userA/userB) ─< directMessages
       ├─< typingIndicators
       └─< callParticipants >─ calls ─< signals

(presence is tracked outside this schema, by the @convex-dev/presence component, keyed by userId
and a per-server "room"; see the presence section above)
```

## Validation Rules Recap (from Functional Requirements)

- `messages.content` / `directMessages.content`: 1–2000 chars (FR-015).
- `serverMembers`: server owner is always also a `serverMembers` row (FR-004); owner cannot be
  removed from own server (Assumptions).
- `channels`: only a `serverMembers` row with `serverId` matching a server whose `ownerId ===
  userId` may create/rename/delete (FR-014).
- `directMessageThreads`: creation requires a shared server (FR-023).
- `callParticipants`: `count(by_call) < 4` required to insert a new row (FR-026); reject with a
  clear error otherwise.
