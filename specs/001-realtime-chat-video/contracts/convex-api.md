# Contracts: Convex Function API

This app has no separate REST/GraphQL layer — the "contract" between frontend and backend is the
set of Convex queries/mutations the React app calls via generated, typed hooks (`useQuery`/
`useMutation`). Every function below MUST perform its own auth/authorization check
(constitution IV) — never rely on the UI to have hidden an action.

Convention: `[query]` = reactive read (subscribes), `[mutation]` = write (one-shot).

## auth.ts

Sign-up and login are **not** custom mutations — they go through Convex Auth's own exported
`signIn("password", formData)` action (client-called via `useAuthActions()`), with a `flow: "signUp"
| "signIn"` form field selecting the mode, and the Password provider's `profile` callback in
`auth.ts` writing `displayName`/`avatarUrl` onto the `users` row at signup time (research.md §1).
There is no `[mutation] signUp` / `[mutation] logIn` in this codebase.

**FR-001a rate limiting — how it's actually enforced**: Convex Auth's Password provider has no
documented callback that fires specifically on a *failed* password attempt, so lockout is
enforced by a client-side-called check/record pair around Convex Auth's own action, backed by the
`failedLoginAttempts`/`lockedUntil` fields on `users` (see `users.ts` below). This is a known,
documented limitation, not a hidden gap: a client that skipped `checkLoginAllowed` and called
`signIn("password", ...)` directly would bypass the lockout. Acceptable for this v1's single
first-party client; flagged here so it isn't silently assumed to be a hard server-side guarantee.

## users.ts

- `[query] checkLoginAllowed(email)` → auth: none (pre-authentication); returns
  `{ allowed: boolean, retryAfter?: number }` by reading `lockedUntil` for the `users` row matching
  `email`. The login form calls this before calling `signIn("password", ...)`.
- `[mutation] recordLoginResult(email, success)` → auth: none (called immediately after
  `signIn` resolves or rejects); on failure increments `failedLoginAttempts` and sets
  `lockedUntil` after N consecutive failures; on success resets both fields (FR-001a).
- `[mutation] updateProfile(displayName?, avatarUrl?)` → auth: caller can only update their own
  `users` row (FR-002).
- `[query] getCurrentUser()` → returns the caller's own profile, or `null` if unauthenticated.

## presence.ts

Thin wrappers around the `@convex-dev/presence` component (research.md §2) — no custom
`presence` table.

- `[mutation] heartbeat(roomId, userId, sessionId, interval)` → auth: caller must be a member of
  the server identified by `roomId` (`roomId === serverId`); delegates to
  `Presence.heartbeat(...)`.
- `[query] list(roomToken)` → auth: enforced by the room token issued only to members of that
  server; returns presence state for that server's members (FR-003).
- `[mutation] disconnect(sessionToken)` → auth: caller's own session only; delegates to
  `Presence.disconnect(...)`.

## servers.ts

- `[mutation] createServer(name, imageUrl?)` → auth: any authenticated user; creates `servers` row
  + owner's `serverMembers` row + default "general" `channels` row in one mutation (FR-004,
  FR-005).
- `[mutation] renameServer(serverId, name)` → auth: caller must be `servers.ownerId` (FR-008,
  FR-010).
- `[mutation] regenerateInvite(serverId)` → auth: owner-only; rotates `inviteCode` (FR-006).
- `[mutation] joinByInvite(inviteCode)` → auth: any authenticated user; looks up server by
  `inviteCode`, rejects with a clear error if not found (Edge Cases: stale/invalid invite),
  inserts `serverMembers` row if not already a member.
- `[mutation] removeMember(serverId, userId)` → auth: caller must be `servers.ownerId`; cannot
  target the owner themself (FR-009, FR-010, Assumptions).
- `[query] listMyServers()` → auth: caller; returns servers where caller has a `serverMembers` row.
- `[query] getServer(serverId)` → auth: caller must be a member; returns server + member list +
  presence (FR-007).

## channels.ts

- `[mutation] createChannel(serverId, name, type)` → auth: owner-only (FR-012, FR-014).
- `[mutation] renameChannel(channelId, name)` → auth: owner-only.
- `[mutation] deleteChannel(channelId)` → auth: owner-only; batch-deletes the channel's `messages`
  first (FR-013), and if it's a voice channel, ends any active call (Edge Cases).
- `[query] listChannels(serverId)` → auth: caller must be a member (FR-011).

## messages.ts

- `[mutation] sendMessage(channelId, content)` → auth: caller must be a member of the channel's
  server; rejects content over 2000 chars (FR-015).
- `[mutation] editMessage(messageId, content)` → auth: caller must be `messages.authorId`
  (FR-018, FR-020).
- `[mutation] deleteMessage(messageId)` → auth: caller must be `messages.authorId` (FR-019,
  FR-020).
- `[query] listMessages(channelId, paginationOpts)` → auth: caller must be a member; returns a
  page ordered newest-first via Convex pagination (FR-021).

## typingIndicators.ts

- `[mutation] setTyping(scope)` → auth: caller must have access to the channel/thread; upserts
  `lastTypedAt = now`.
- `[mutation] clearTyping(scope)` → auth: same access check; deletes the caller's row.
- `[query] listTypingUsers(scope)` → auth: same access check; returns users with `lastTypedAt`
  within the freshness window (FR-022).
- Scheduled function `sweepStaleTyping` (internal) → deletes rows past the freshness window as a
  backstop for clients that disconnect without calling `clearTyping`.

## directMessageThreads.ts / directMessages.ts

- `[mutation] openThread(otherUserId)` → auth: caller; requires a shared server membership with
  `otherUserId` (FR-023); find-or-create on the canonical `[userAId, userBId]` pair.
- `[query] listMyThreads()` → auth: caller; threads where caller is `userAId` or `userBId`.
- `[mutation] sendDirectMessage(threadId, content)` / `editDirectMessage` / `deleteDirectMessage`
  → auth: caller must be a thread participant (send) or the message's `authorId` (edit/delete);
  same behavior as channel messages (FR-024).
- `[query] listDirectMessages(threadId, paginationOpts)` → auth: caller must be a thread
  participant.

## calls.ts

- `[mutation] joinCall(location)` → auth: caller must have access to the voice channel's server or
  the DM thread; creates the `calls` row if none exists for that location, else joins the
  existing one; rejects with a clear "call is full" error if `callParticipants` count for that
  call is already 4 (FR-025, FR-026).
- `[mutation] leaveCall(callId)` → auth: caller must be a participant; deletes their
  `callParticipants` row and any of their pending `signals`; deletes the `calls` row itself if no
  participants remain (FR-030).
- `[mutation] updateParticipantState(callId, micOn?, cameraOn?, isSpeaking?)` → auth: caller can
  only update their own `callParticipants` row (FR-027, FR-028).
- `[query] listParticipants(callId)` → auth: caller must be a participant; drives video tiles,
  mute/speaking indicators (FR-028).
- `[query] listActiveCallsForServer(serverId)` → auth: caller must be a member; drives "who's
  connected" in the channel list (FR-029).
- `[mutation] callHeartbeat(callId)` → auth: caller must be a participant; updates their own
  `callParticipants.lastHeartbeatAt` (client calls this on a ~5s interval while connected).
- Scheduled function `sweepStaleCallParticipants` (internal, no client auth surface) → every
  ~10s, deletes any `callParticipants` row whose `lastHeartbeatAt` is older than ~15s, then
  deletes the parent `calls` row if it has no participants left. This is what satisfies the
  spec's "connection drops mid-call" edge case (spec.md line 119) — without it, a crashed/closed
  client would occupy a call slot forever (FR-026's 4-participant cap would never free up).

## signals.ts

- `[mutation] sendSignal(callId, toUserId, type, payload)` → auth: caller must be a participant in
  `callId` and `toUserId` must also be a participant.
- `[query] listSignalsForMe(callId)` → auth: caller must be a participant; returns signals
  addressed to the caller, ordered by `_creationTime`.
- `[mutation] consumeSignal(signalId)` → auth: caller must be the signal's `toUserId`; deletes it
  after the client applies it locally (research.md §4).
