# Phase 0 Research: Real-Time Chat & Video Calling Application

All Technical Context items were specified by the user for this feature; no
`NEEDS CLARIFICATION` markers remain. This document records the concrete decisions and the
implementation-pattern research needed to execute them safely.

> **Verification pass (2026-07-14)**: Sections 1, 2, 4, and 5 below were re-verified against
> current official documentation (Convex docs, `@convex-dev/auth`/`@convex-dev/presence` package
> docs, MDN, webrtc.org) and updated with exact package versions, file layouts, and API calls.
> Changes from the original draft are called out inline as **Update**.

## 1. Auth: Convex Auth password provider

- **Decision**: Use `@convex-dev/auth` (pin exact version `0.0.94`) with its required peer
  dependency `@auth/core` pinned to exactly `0.41.1`, and the `Password` provider. Extend the
  auth-managed `users` table directly (via `authTables.users`) with optional `displayName` and
  `avatarUrl` fields, populated at signup through the provider's `profile` callback — not a
  separately joined profile table.
- **Update vs. original draft**: the original note said to "join" a separate profile onto Convex
  Auth's identity; current docs' supported pattern is to inline the extra fields directly into
  the schema's copy of `authTables.users`, since Convex Auth expects to own and extend that same
  table.
- **Exact install/setup** (verified against `labs.convex.dev/auth` docs, 2026-07-14):
  ```bash
  npm install @convex-dev/auth @auth/core@0.41.1
  npx @convex-dev/auth   # scaffolds convex/auth.ts, convex/auth.config.ts, convex/http.ts
  ```
  `tsconfig.json` needs `"skipLibCheck": true` and `"moduleResolution": "Bundler"`.

  `convex/auth.ts`:
  ```ts
  import { convexAuth } from "@convex-dev/auth/server";
  import { Password } from "@convex-dev/auth/providers/Password";

  export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
    providers: [
      Password({
        profile(params) {
          return {
            email: params.email as string,
            displayName: params.displayName as string,
            avatarUrl: params.avatarUrl as string | undefined,
          };
        },
      }),
    ],
  });
  ```
  `convex/auth.config.ts`:
  ```ts
  export default {
    providers: [{ domain: process.env.CONVEX_SITE_URL, applicationID: "convex" }],
  };
  ```
  `convex/http.ts`:
  ```ts
  import { httpRouter } from "convex/server";
  import { auth } from "./auth";
  const http = httpRouter();
  auth.addHttpRoutes(http);
  export default http;
  ```
  `convex/schema.ts` (inline, extended `authTables.users` — see `data-model.md` for the full
  field list):
  ```ts
  import { defineSchema, defineTable } from "convex/server";
  import { v } from "convex/values";

  const schema = defineSchema({
    users: defineTable({
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      displayName: v.optional(v.string()),
      avatarUrl: v.optional(v.string()),
      failedLoginAttempts: v.optional(v.number()),
      lockedUntil: v.optional(v.number()),
    }).index("email", ["email"]),
    // ...authAccounts, authSessions, etc. still come from `authTables` spread in, minus `users`
    // ...app tables (servers, channels, messages, etc.)
  });
  export default schema;
  ```
  Client (`src/main.tsx`) uses `ConvexAuthProvider` (Vite/React path — no Next.js middleware
  needed):
  ```tsx
  import { ConvexAuthProvider } from "@convex-dev/auth/react";
  import { ConvexReactClient } from "convex/react";

  const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

  root.render(
    <ConvexAuthProvider client={convex}><App /></ConvexAuthProvider>,
  );
  ```
  Sign-in/sign-up forms use `useAuthActions()` from `@convex-dev/auth/react`, calling
  `signIn("password", formData)` with a hidden `flow` field set to `"signIn"` or `"signUp"`; UI
  gating uses `Authenticated`/`Unauthenticated`/`AuthLoading` from **`convex/react`** (not the
  auth package).
- **Login rate-limiting (FR-001a) — confirmed still hand-rolled**: Convex Auth's built-in rate
  limiting only covers the password-reset verification flow (backed by its own
  `authRateLimits` table), not plain password sign-in failures, and the Password provider exposes
  no documented callback that fires specifically on a failed attempt. Since the client calls
  Convex Auth's own `signIn("password", ...)` action directly (there is no mutation of ours to
  intercept it inside), lockout is enforced as a client-orchestrated check/record pair around that
  call: `checkLoginAllowed(email)` (query, before) and `recordLoginResult(email, success)`
  (mutation, after), both operating on `failedLoginAttempts`/`lockedUntil` on the `users` row (see
  `contracts/convex-api.md`). This is a client-enforced convention, not a hard server-side gate
  inside Convex Auth's action — documented as a known v1 limitation rather than papered over.
- **Rationale**: Matches the user-specified stack; the `profile` callback and inline schema
  extension are Convex Auth's own documented mechanism for custom fields, so this needs no extra
  library.
- **Risk to track, not hide**: `@convex-dev/auth` is pre-1.0 ("beta... may change in
  backward-incompatible ways" per its own docs) — pin the exact version in `package.json` and
  treat any upgrade as a deliberate, tested step, not an automatic `^` bump. Convex also now
  offers `@convex-dev/better-auth` as a newer alternative; not adopted here since the user's plan
  explicitly specified Convex Auth with the password provider, but worth knowing if Convex Auth's
  beta rough edges become blocking.
- **Alternatives considered**: Custom JWT/session system (rejected — reinvents what Convex Auth
  already does, violates Simplicity First); Clerk/Auth0/Better Auth (rejected — external
  service/cost the plan input didn't call for; Convex Auth was explicitly specified).

## 2. Presence (online/offline)

- **Update vs. original draft**: Convex now publishes an official **`@convex-dev/presence`**
  component (verified current npm version `0.3.2`) that replaces the originally-planned DIY
  heartbeat table + manual scheduled sweep. Adopting the official component is simpler
  (Simplicity First) and better-maintained than hand-rolled staleness logic.
- **Decision**: Use `@convex-dev/presence` for online/offline tracking.
  ```bash
  npm install @convex-dev/presence
  ```
  `convex/convex.config.ts`:
  ```ts
  import { defineApp } from "convex/server";
  import presence from "@convex-dev/presence/convex.config.js";
  const app = defineApp();
  app.use(presence);
  export default app;
  ```
  `convex/presence.ts` (thin wrapper so we can layer our own membership auth check — see
  Security Basics below):
  ```ts
  import { mutation, query } from "./_generated/server";
  import { components } from "./_generated/api";
  import { v } from "convex/values";
  import { Presence } from "@convex-dev/presence";

  const presence = new Presence(components.presence);

  export const heartbeat = mutation({
    args: { roomId: v.string(), userId: v.string(), sessionId: v.string(), interval: v.number() },
    handler: (ctx, a) => presence.heartbeat(ctx, a.roomId, a.userId, a.sessionId, a.interval),
  });
  export const list = query({
    args: { roomToken: v.string() },
    handler: (ctx, { roomToken }) => presence.list(ctx, roomToken),
  });
  export const disconnect = mutation({
    args: { sessionToken: v.string() },
    handler: (ctx, { sessionToken }) => presence.disconnect(ctx, sessionToken),
  });
  ```
  Client: `usePresence(api.presence, roomId, displayName)` from `@convex-dev/presence/react`
  drives per-server online/offline lists (one "room" per server, keyed by `serverId`); the
  component's own heartbeat/disconnect-detection replaces our planned manual sweep.
- **Follow-up needed (not yet applied)**: `data-model.md`'s standalone `presence` table entry and
  `plan.md`'s `convex/presence.ts` description should be updated to reflect the component
  replacing that hand-written table — flagging this so it isn't silently inconsistent, but not
  changing those files in this pass since only `research.md` was requested to be updated now.
- **Rationale**: An officially maintained component removes an entire category of DIY
  staleness/cleanup bugs (missed sweeps, clock skew) for no cost, and still satisfies FR-003 and
  the constitution's "reactive subscriptions, not polling" rule (the component's `list` query is
  a normal `useQuery`-style reactive read).
- **Alternatives considered**: Original DIY heartbeat table + cron sweep (viable, still documented
  above as the fallback) — superseded now that an official component exists; relying solely on
  Convex's WebSocket connection lifecycle alone — still rejected for the same reason as before
  (closed-lid/suspended-tab cases don't always fire clean disconnects promptly), which is exactly
  what the presence component's heartbeat protocol already handles.

## 3. Typing indicators

- **Decision unchanged**: keep a dedicated `typingIndicators` table (see `data-model.md`) rather
  than overloading the presence component's generic per-room metadata, because typing needs a
  much shorter freshness window (~5s) than presence's (~25s) and is scoped per-channel/per-thread
  rather than per-server-room. Client sends a `setTyping` mutation on keystroke (throttled to
  ~2s), `clearTyping` on send/blur; a scheduled sweep deletes rows older than the freshness
  window as a backstop.
- **Rationale**: Reusing presence's `list`/heartbeat semantics for a different TTL and a
  different scope key (channel/thread vs. server room) would need its own mapping layer anyway —
  a small dedicated table stays simpler and keeps the two concerns (online/offline vs.
  "composing right now") independently tunable.
- **Alternatives considered**: Piggybacking on `@convex-dev/presence`'s per-user metadata field —
  considered given §2's finding that the component now exists, but rejected for the freshness-
  window/scope mismatch above; ephemeral client-only signaling with no persistence — rejected,
  Convex's reactivity model is table-subscription-based, so a table row remains the natural "push
  update to subscribers" unit here.

## 3a. Call roster lifecycle and dropped-connection handling

- **Decision (added — plan-audit finding, 2026-07-14)**: Add `lastHeartbeatAt` to
  `callParticipants` and a `callHeartbeat` mutation the client calls every ~5s while connected to
  a call; a scheduled `sweepStaleCallParticipants` function runs every ~10s, deleting any
  participant row older than ~15s (3 missed heartbeats) and deleting the parent `calls` row if it
  becomes empty.
- **Why this was missing and needed to be added**: `presence` and `typingIndicators` both had a
  staleness/cleanup mechanism from the start, but `callParticipants` originally only had an
  explicit `leaveCall` mutation — nothing handled a crashed tab or dropped connection. That left
  the spec's own Edge Case ("what happens when a member's connection drops mid-call?", spec.md
  line 119 — participants must be shown as disconnected "within a short delay") with no
  implementation path, and meant a phantom participant row could permanently occupy one of the 4
  call slots (FR-026).
- **Rationale**: Mirrors the same heartbeat+sweep shape already used for presence/typing, at a
  shorter timeout appropriate for a live call (users expect faster drop-detection in an active
  call than in a general online/offline indicator). This is a server-side, authoritative cleanup
  layered under the client-side WebRTC connection-state handling (§4's `oniceconnectionstatechange`
  logic) — the ICE state gives a fast *local* signal that a specific peer connection failed, while
  the heartbeat sweep is the fallback that guarantees the shared roster (and the 4-participant
  cap) eventually recovers even if a client disappears without any clean signal at all.
- **Alternatives considered**: Relying solely on WebRTC's own `oniceconnectionstatechange`/
  `failed` state to trigger a `leaveCall` call from the *other* participants — rejected as the
  sole mechanism, since it depends on every remaining participant's browser correctly detecting
  and acting on the failure, with no authoritative single source of truth for "is this call slot
  actually free"; a server-side heartbeat sweep is simpler to reason about and matches the
  pattern already established for presence/typing.

## 4. WebRTC signaling and peer connection management

- **Signaling transport (unchanged)**: A `signals` table with fields `callId`, `fromUserId`,
  `toUserId`, `type` (`offer`/`answer`/`ice-candidate`), `payload` (JSON string),
  `_creationTime`. Each participant subscribes via `useQuery` to signals addressed to them for the
  active call, and deletes each row via a `consumeSignal` mutation once applied. This directly
  replaces a Socket.io signaling server with Convex's existing reactive-query mechanism, per the
  user's specified approach.

- **Update — explicit peer-connection lifecycle trigger (plan-audit finding, 2026-07-14)**: the
  event that creates/closes each pairwise `RTCPeerConnection` is the reactive `listParticipants`
  `useQuery` result changing. `usePeerConnections.ts` MUST diff successive results of that query:
  for every participant present now but not in the previous result, create an `RTCPeerConnection`
  and begin perfect negotiation with them (§ below); for every participant present before but
  missing now (whether from an explicit `leaveCall` or from `sweepStaleCallParticipants` removing
  them per §3a), `.close()` that peer's connection and remove its video tile. This was previously
  implicit; calling it out because it's the load-bearing link between "Convex pushes a roster
  update" and "the browser actually opens/tears down a WebRTC connection."

- **Update — perfect negotiation pattern, verified current against MDN
  (2026-07-14, https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation)**:
  this is still the current recommended pattern for glare-free offer/answer negotiation. Exact
  shape to implement per pairwise `RTCPeerConnection`:
  ```js
  let makingOffer = false;
  let ignoreOffer = false;
  let isSettingRemoteAnswerPending = false;
  const polite = myUserId < remotePeerUserId; // deterministic per-pair tie-break, see below

  pc.onnegotiationneeded = async () => {
    try {
      makingOffer = true;
      await pc.setLocalDescription();           // zero-arg form auto-creates offer or answer
      sendSignal({ type: "offer", payload: pc.localDescription });
    } finally {
      makingOffer = false;
    }
  };

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) sendSignal({ type: "ice-candidate", payload: candidate });
  };

  async function onSignal({ type, payload }) {
    if (type === "offer" || type === "answer") {
      const readyForOffer =
        !makingOffer && (pc.signalingState === "stable" || isSettingRemoteAnswerPending);
      const offerCollision = type === "offer" && !readyForOffer;
      ignoreOffer = !polite && offerCollision;
      if (ignoreOffer) return;

      isSettingRemoteAnswerPending = type === "answer";
      await pc.setRemoteDescription(payload);
      isSettingRemoteAnswerPending = false;

      if (type === "offer") {
        await pc.setLocalDescription();          // auto-creates the answer
        sendSignal({ type: "answer", payload: pc.localDescription });
      }
    } else if (type === "ice-candidate") {
      try {
        await pc.addIceCandidate(payload);
      } catch (err) {
        if (!ignoreOffer) throw err;
      }
    }
  }
  ```
  Collision handling is decided inline via `pc.signalingState` — no separate
  `onsignalingstatechange` listener needed. `setLocalDescription()`/`setRemoteDescription()` zero-
  /auto-argument forms are current (not deprecated); the older 3-argument callback forms of
  `createOffer`/`createAnswer`/`setLocalDescription` are explicitly discouraged by MDN now.

- **Update — per-pair polite/impolite role for full mesh (4 participants ⇒ 6 pairwise
  connections)**: MDN leaves the polite/impolite assignment mechanism to the app; the standard
  community approach for mesh topologies (no dedicated spec guidance beyond the 2-peer case) is a
  deterministic, symmetric tie-break both sides can compute without extra signaling — compare
  stable user IDs per pair: `const polite = myUserId < remoteUserId;`. Each pairwise
  `RTCPeerConnection` keeps its **own** `makingOffer`/`ignoreOffer`/`isSettingRemoteAnswerPending`
  state (not shared globally across the mesh) — implemented as one instance of the state above
  per entry in a `Map<remoteUserId, RTCPeerConnection>`.

- **Update — ICE restart**: prefer `pc.restartIce()` (current MDN-recommended, zero-argument,
  broadly supported since ~2021) over passing `{ iceRestart: true }` to `createOffer()` — MDN's
  own `createOffer()` docs now point callers to `restartIce()` instead. Trigger it on ICE failure:
  ```js
  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === "failed") {
      pc.restartIce();
    }
  };
  ```
  Different browsers restart under different conditions; not guaranteed to always succeed without
  a TURN server (see limitation below).

- **Update — trickle ICE candidate ordering**: `addIceCandidate()` throws `InvalidStateError` if
  called before `setRemoteDescription()` has resolved, and MDN documents no automatic queuing
  across that gap. Since our signaling relay (Convex `signals` table subscription) doesn't
  guarantee delivery order relative to the offer/answer row, the client must buffer any
  ICE-candidate signals that arrive before the matching remote description is set, and flush the
  buffer immediately after — this remains app-level logic, not something Convex or the browser
  handles for us.

- **Known limitation to document, not silently drop**: STUN-only ICE
  (`stun:stun.l.google.com:19302`) — verified no official Google deprecation notice as of
  2026-07-14, but it is an **unofficial, no-SLA free service**; do not treat it as guaranteed
  available in production, only acceptable for a student project's dev/demo use. No TURN server
  in v1 means participants behind symmetric NATs or restrictive firewalls may see
  `iceConnectionState` stuck in `"checking"` or moving to `"failed"`; the call UI must surface a
  clear "couldn't connect" state on that transition (driven by `oniceconnectionstatechange`)
  rather than hanging silently.

- **Alternatives considered**: A managed WebRTC SFU (LiveKit/Daily/Twilio) — explicitly rejected
  by the user's plan input ("no SDK like LiveKit or Twilio"); full mesh is an accepted tradeoff
  given the 4-participant cap.

## 5. Data pagination pattern (infinite scroll, newest-first)

- **Update — direction detail corrected**: Convex's `.paginate()` is not hard-wired to a fixed
  direction; it follows whichever `.order("asc" | "desc")` is set on the underlying indexed
  query. Verified current (`docs.convex.dev/database/pagination`, `stack.convex.dev/pagination`,
  2026-07-14) pattern for a newest-first chat history with "load older on scroll up":
  ```ts
  // convex/messages.ts
  import { paginationOptsValidator } from "convex/server";

  export const list = query({
    args: { channelId: v.id("channels"), paginationOpts: paginationOptsValidator },
    handler: (ctx, { channelId, paginationOpts }) =>
      ctx.db.query("messages")
        .withIndex("by_channel", (q) => q.eq("channelId", channelId))
        .order("desc")                      // page 1 = newest N messages
        .paginate(paginationOpts),
  });
  ```
  ```tsx
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.list,
    { channelId },
    { initialNumItems: 25 },
  );
  ```
  `results` accumulates in the order returned (newest-first here); `loadMore(n)` fetches
  progressively **older** pages, matching "scroll up to load history." The chat pane reverses
  `results` (or renders in a flex-column-reverse container) purely for display (oldest-at-top,
  newest-at-bottom) — Convex does not need a distinct "reverse pagination" mode, it's just a
  choice of index order plus a client-side render-order flip. This satisfies FR-021 and SC-007
  (sub-1s page loads at 10k+ messages) exactly as originally planned; only the directional
  explanation was imprecise before.
- **Alternatives considered**: Offset-based pagination — rejected, degrades at scale and shifts
  under concurrent writes.

## 6. Testing strategy per constitution Principle VI (Testable Seams)

- **Decision (unchanged)**: Three layers —
  1. `convex-test` for every query/mutation's business/authorization logic (e.g., "non-owner
     cannot rename channel", "non-member cannot open DM") run directly against Convex functions,
     no UI involved.
  2. Vitest + React Testing Library for pure frontend logic and hooks that don't need a live
     backend (e.g., WebRTC mesh bookkeeping — polite/impolite tie-break, signal buffering — and
     message-grouping/formatting utilities).
  3. Playwright for exactly the two constitution-mandated critical-flow smoke tests: sending a
     message end-to-end (US1) and joining a call end-to-end (US5), run against a real (test)
     Convex deployment.
- **Rationale**: Matches the constitution's explicit requirement for logic/UI separation and
  minimum smoke-test coverage without adding a full E2E suite the spec doesn't ask for
  (Simplicity First).
- **Alternatives considered**: Cypress (rejected — Playwright is equally capable and already
  common in the Vite/React ecosystem); skipping E2E entirely (rejected — violates the
  constitution's explicit smoke-test mandate).

## 7. Deployment

- **Decision (unchanged)**: Convex backend deployed via `npx convex deploy`; Vite SPA deployed to
  Vercel as a static build, with `VITE_CONVEX_URL` supplied as a Vercel environment variable at
  build time.
- **Rationale**: Convex and Vercel are the two pieces of managed infrastructure the stack already
  implies; no server to operate for the frontend.
- **Alternatives considered**: Self-hosting the SPA (rejected — no stated requirement, adds ops
  burden a student project doesn't need).

**Output**: All unknowns resolved; no open `NEEDS CLARIFICATION` items remain for Phase 1.
Verified package versions to pin: `@convex-dev/auth@0.0.94`, `@auth/core@0.41.1`,
`@convex-dev/presence@0.3.2`, `convex@1.42.1` (or latest `1.x` at implementation time — re-check
before pinning, since this is a fast-moving beta-adjacent ecosystem).
