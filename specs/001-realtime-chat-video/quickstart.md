# Quickstart: Real-Time Chat & Video Calling Application

Validates that the feature works end-to-end once implemented. This is a run/validation guide, not
an implementation reference — see `data-model.md` and `contracts/convex-api.md` for the schema
and function contracts, and `tasks.md` (from `/speckit-tasks`) for build steps.

## Prerequisites

- Node.js 20+
- A Convex account (`npx convex login`) and a dev deployment for this project
- Two browser sessions (or two browsers/profiles) to simulate two different users

## Setup

```bash
npm install
npx convex dev        # starts the Convex dev deployment, writes .env.local with VITE_CONVEX_URL
npm run dev            # starts the Vite dev server
```

## Validation Scenarios

Each scenario maps to a user story in `spec.md` and should be run manually (or via the Playwright
smoke tests once written) before considering that story done, per constitution Principle V
(incremental delivery — the app must build and run after each story).

### 1. Sign up, create a server, chat in real time (US1 — P1)

1. In browser session A, sign up as "Alice". Confirm you land in the app logged in.
2. Create a server named "Test Server". Confirm you're redirected into its default `general`
   channel.
3. In browser session B, sign up as "Bob".
4. Have Alice generate/share the invite; Bob joins via it.
5. Alice sends a message in `general`. **Expected**: it appears in Bob's view within ~1s with no
   manual refresh (SC-002), showing Alice's name, avatar, and timestamp.
6. Confirm both Alice's and Bob's online status show correctly in the member sidebar for each
   other.

### 2. Invites, channels, membership management (US2 — P2)

1. As Alice (owner), create a second text channel and a voice channel. **Expected**: both appear
   immediately in Bob's channel list.
2. Rename the server and a channel. **Expected**: new names appear for Bob without refresh.
3. As Bob, attempt to rename the server or delete a channel. **Expected**: rejected.
4. As Alice, delete the second text channel. **Expected**: it (and its messages) disappear for
   Bob.
5. As Alice, remove Bob from the server. **Expected**: Bob loses access to the server's channels.

### 3. Message editing, typing, history (US3 — P2)

1. Send a message, then edit it. **Expected**: updated content shows an "(edited)" marker for all
   viewers.
2. Delete a message. **Expected**: it disappears for all viewers.
3. Start typing (without sending). **Expected**: the other user sees a typing indicator that
   clears a few seconds after you stop.
4. Seed (or send) more messages than fit on screen in one channel; scroll up. **Expected**: older
   messages load incrementally, newest shown first by default.

### 4. Direct messages (US4 — P3)

1. As Alice, open a DM with Bob (they share "Test Server"). Send a message. **Expected**: appears
   for Bob in real time; editable/deletable the same way as channel messages.
2. Create a third user, Carol, who shares no server with Alice. **Expected**: Alice cannot open a
   DM with Carol.

### 5. Voice/video calls (US5 — P4)

1. As Alice, join the voice channel. **Expected**: call starts, Alice's own tile shows with mic
   on/camera off by default.
2. As Bob, join the same voice channel. **Expected**: Alice and Bob see/hear each other; the
   channel list shows both connected.
3. Toggle mic/camera on either side. **Expected**: the other participant's view of that tile
   updates within ~2s (SC-005).
4. Speak into the mic. **Expected**: the speaking participant's tile shows a speaking indicator.
5. Have a 3rd and 4th user join the same call; then attempt a 5th. **Expected**: the 5th join is
   rejected with a clear "call is full" message (FR-026).
6. Leave the call as each participant in turn. **Expected**: the call ends when the last
   participant leaves.
7. From an open DM, start a 1-on-1 video call. **Expected**: same controls (mic/camera/leave)
   work as in a voice-channel call.

## Known Limitation to Verify, Not "Fix"

- No TURN server is configured (STUN only). If a call fails to connect between two networks with
  restrictive/symmetric NAT, the call UI should show a clear "couldn't connect" state rather than
  hanging silently — verify this failure mode is visible, not just the happy path.

## Automated Coverage

- `tests/e2e/send-message.spec.ts` (Playwright): automates Scenario 1, steps 1–5.
- `tests/e2e/join-call.spec.ts` (Playwright): automates Scenario 5, steps 1–3.
- `tests/convex/*.test.ts` (`convex-test`): authorization rules from `contracts/convex-api.md`
  (e.g., non-owner rename rejected, non-member DM rejected, 5th call participant rejected).
