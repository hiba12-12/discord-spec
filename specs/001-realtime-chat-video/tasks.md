---

description: "Task list template for feature implementation"
---

# Tasks: Real-Time Chat & Video Calling Application

**Input**: Design documents from `/specs/001-realtime-chat-video/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/convex-api.md, quickstart.md (all present)

**Tests**: Included, but scoped to the constitution's actual mandate (Principle VI, Testable
Seams): `convex-test` coverage for every authorization/business rule in
`contracts/convex-api.md`, plus exactly the two constitution-mandated Playwright smoke tests
(send a message, join a call). No broader test suite is added beyond that — Simplicity First.

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P4) to enable
independent implementation, testing, and incremental delivery per constitution Principle V.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- File paths match `plan.md`'s Project Structure section

## Path Conventions

Single repo, no `backend/`/`frontend/` split: Convex functions in `convex/`, Vite SPA in `src/`,
tests in `tests/{unit,convex,e2e}/` — per `plan.md`'s Structure Decision.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and tooling, no feature logic yet.

- [X] T001 Initialize Vite + React 18 + TypeScript (strict mode) project at repo root (`package.json`, `vite.config.ts`, `tsconfig.json` per plan.md Technical Context)
- [X] T002 [P] Install and configure Tailwind CSS with a Discord-like dark theme token set in `tailwind.config.ts` and `src/styles/index.css`
- [X] T003 [P] Install React Router and create an empty route tree scaffold in `src/App.tsx`
- [X] T004 Initialize the Convex project (`npx convex dev` scaffold) and create `.env.local` (gitignored) with `VITE_CONVEX_URL`
- [X] T005 [P] Configure ESLint + strict TypeScript checks across `src/` and `convex/` (no `any`, no `@ts-ignore` without justification, per constitution Additional Constraints)
- [X] T006 [P] Configure Vitest + React Testing Library in `vite.config.ts`/`vitest.config.ts` and create `tests/unit/`
- [X] T007 [P] Configure Playwright in `playwright.config.ts` and create `tests/e2e/`
- [X] T008 [P] Configure `convex-test` and create `tests/convex/`

**Checkpoint**: Empty app builds and runs; no feature code yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, auth, presence, and shared authorization helpers that every user story
depends on. **No user story work can begin until this phase is complete.**

- [X] T009 Define the complete schema in `convex/schema.ts`: extended `authTables.users`
  (`displayName`, `avatarUrl`, `failedLoginAttempts`, `lockedUntil`) plus `servers`,
  `serverMembers`, `channels`, `messages`, `directMessageThreads`, `directMessages`,
  `typingIndicators`, `calls`, `callParticipants` (including `lastHeartbeatAt`), `signals` — all
  fields and indexes exactly as specified in `data-model.md` (no `presence` table — that's the
  component installed in T011)
- [X] T010 Set up `@convex-dev/auth` per research.md §1: install `@convex-dev/auth@0.0.94` +
  `@auth/core@0.41.1`, create `convex/auth.ts` (Password provider + `profile` callback writing
  `displayName`/`avatarUrl`), `convex/auth.config.ts`, `convex/http.ts`; wire
  `ConvexAuthProvider` in `src/main.tsx`
- [X] T011 [P] Set up `@convex-dev/presence@0.3.2` per research.md §2: `convex/convex.config.ts`
  registering the component, and a thin `convex/presence.ts` wrapper (`heartbeat`, `list`,
  `disconnect`) with a server-membership auth check layered on top
- [X] T012 [P] Implement shared authorization helpers in `convex/lib/authz.ts`: `requireServerMember(ctx, serverId)`, `requireServerOwner(ctx, serverId)`, `requireMessageAuthor(ctx, messageId)`, `requireCallParticipant(ctx, callId)`, `requireDmThreadParticipant(ctx, threadId)` — every function in every subsequent `convex/*.ts` module MUST use one of these (constitution Principle IV)
- [X] T013 Implement `convex/users.ts`: `checkLoginAllowed(email)`, `recordLoginResult(email, success)` (FR-001a rate limiting per contracts/convex-api.md — client-orchestrated check/record pair around Convex Auth's own `signIn`), `updateProfile(displayName?, avatarUrl?)`, `getCurrentUser()`
- [X] T014 Build the authenticated app shell: `src/routes/LoginPage.tsx`, `src/routes/SignupPage.tsx` (using `useAuthActions().signIn("password", formData)` with a `flow` field, plus a `checkLoginAllowed`/`recordLoginResult` call around it), `src/routes/ServerLayout.tsx` (empty shell), and `Authenticated`/`Unauthenticated`/`AuthLoading` gating in `src/App.tsx`

**Checkpoint**: A user can sign up, log in, stay logged in across reloads, and see an empty
authenticated shell. Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Sign Up, Create a Server, and Chat in Real Time (Priority: P1) 🎯 MVP

**Goal**: A new user signs up, creates a server, and exchanges real-time text messages with
another member in the default `general` channel — no refresh required.

**Independent Test**: Sign up two accounts, have one create a server and share it (direct DB/UI
action is fine here — invite links are US2), have both view `general`, and confirm messages sent
by either appear for both within ~1s (SC-002).

### Tests for User Story 1 ⚠️

- [X] T015 [P] [US1] Playwright smoke test covering quickstart.md Scenario 1 (sign up, create server, send message, verify real-time delivery with no refresh) in `tests/e2e/send-message.spec.ts` — constitution-mandated critical-flow smoke test
- [X] T016 [P] [US1] convex-test: `servers.createServer` creates a server + owner `serverMembers` row + default `general` channel in one mutation, in `tests/convex/servers.test.ts`
- [X] T017 [P] [US1] convex-test: `messages.sendMessage` rejects non-members and rejects content over 2000 chars, in `tests/convex/messages.test.ts`

### Implementation for User Story 1

- [X] T018 [P] [US1] Implement `convex/servers.ts`: `createServer(name, imageUrl?)`, `listMyServers()`, `getServer(serverId)`
- [X] T019 [P] [US1] Implement `convex/serverMembers.ts`: membership query helpers used by `authz.ts` and `getServer`
- [X] T020 [P] [US1] Implement `convex/channels.ts`: `listChannels(serverId)` (create/rename/delete land in US2)
- [X] T021 [US1] Implement `convex/messages.ts`: `sendMessage(channelId, content)` and `listMessages(channelId, paginationOpts)` (newest-first via `.order("desc")` per research.md §5; edit/delete land in US3) — depends on T018–T020
- [X] T022 [P] [US1] Build signup/login forms in `src/features/auth/SignupForm.tsx`, `src/features/auth/LoginForm.tsx` (wired to T014's pages)
- [X] T023 [US1] Build create-server UI in `src/features/servers/CreateServerForm.tsx` — depends on T018
- [X] T024 [US1] Build the server rail + minimal channel sidebar (general channel only) in `src/routes/ServerLayout.tsx` — depends on T020, T023
- [X] T025 [US1] Build the chat pane (`useQuery(api.messages.listMessages)` + composer calling `sendMessage`) in `src/features/messages/ChatPane.tsx`, `src/features/messages/Composer.tsx` — depends on T021
- [X] T026 [US1] Build the member sidebar with online/offline dots using `usePresence` from `@convex-dev/presence/react` in `src/features/servers/MemberList.tsx` — depends on T011, T024

**Checkpoint**: User Story 1 is fully functional and independently testable/demoable — this is the MVP.

---

## Phase 4: User Story 2 - Grow a Server with Invites, Channels, and Membership Management (Priority: P2)

**Goal**: The owner invites others via a link, manages channels (create/rename/delete text and
voice), renames the server, and removes members.

**Independent Test**: Owner generates an invite, a second user joins via it, owner creates/renames
additional channels, owner removes a member — independent of DMs or calls.

### Tests for User Story 2 ⚠️

- [X] T027 [P] [US2] convex-test: `servers.joinByInvite` accepts a valid `inviteCode` and rejects an invalid/stale one; `regenerateInvite` is owner-only, in `tests/convex/servers-invite.test.ts`
- [X] T028 [P] [US2] convex-test: `channels.createChannel`/`renameChannel`/`deleteChannel` are owner-only, and `deleteChannel` cascades to delete the channel's messages and ends any active call, in `tests/convex/channels.test.ts`
- [X] T029 [P] [US2] convex-test: `servers.removeMember` is owner-only and rejects targeting the owner themself, in `tests/convex/servers-members.test.ts`

### Implementation for User Story 2

- [X] T030 [US2] Implement `convex/servers.ts`: `regenerateInvite(serverId)`, `joinByInvite(inviteCode)`, `renameServer(serverId, name)`, `removeMember(serverId, userId)` — depends on T018
- [X] T031 [US2] Implement `convex/channels.ts`: `createChannel(serverId, name, type)`, `renameChannel(channelId, name)`, `deleteChannel(channelId)` (batch-delete messages via `by_channel` index; end active call if voice) — depends on T020
- [X] T032 [P] [US2] Build invite UI: generate/copy invite link in `src/features/servers/InviteControls.tsx`, and a join-by-invite landing route in `src/routes/JoinInvitePage.tsx`
- [X] T033 [US2] Build channel management UI (create/rename/delete dialogs, owner-only visibility) in `src/features/channels/ChannelSidebar.tsx`, `src/features/channels/ChannelDialogs.tsx` — depends on T031
- [X] T034 [US2] Build server rename + remove-member UI in `src/features/servers/ServerSettings.tsx` (extends `MemberList.tsx` from US1) — depends on T030

**Checkpoint**: User Stories 1 and 2 both work independently; a server can now grow past one owner and one channel.

---

## Phase 5: User Story 3 - Rich Message Editing and History (Priority: P3 in build order; P2 in spec.md)

**Goal**: Members edit/delete their own messages, see typing indicators, and scroll back through
incrementally-loaded history.

**Independent Test**: Within a channel already covered by US1 — send, edit, delete a message;
observe a typing indicator; scroll up through enough history to trigger incremental loading.

### Tests for User Story 3 ⚠️

- [X] T035 [P] [US3] convex-test: `messages.editMessage`/`deleteMessage` are author-only, in `tests/convex/messages-edit.test.ts`
- [X] T036 [P] [US3] convex-test: `typingIndicators.setTyping`/`clearTyping`/`listTypingUsers` freshness-window filtering, in `tests/convex/typing.test.ts`
- [X] T037 [P] [US3] Vitest: newest-first pagination result is correctly reversed for oldest-at-top display, in `tests/unit/messagePagination.test.ts`

### Implementation for User Story 3

- [X] T038 [US3] Implement `convex/messages.ts`: `editMessage(messageId, content)`, `deleteMessage(messageId)` — depends on T021
- [X] T039 [US3] Implement `convex/typingIndicators.ts`: `setTyping(scope)`, `clearTyping(scope)`, `listTypingUsers(scope)`, `sweepStaleTyping` scheduled function
- [X] T040 [US3] Add edit/delete controls and an "(edited)" marker to `src/features/messages/MessageItem.tsx` — depends on T038
- [X] T041 [US3] Add typing-indicator UI and composer keystroke wiring (throttled `setTyping` calls) in `src/features/messages/TypingIndicator.tsx`, `src/features/messages/Composer.tsx` — depends on T039
- [X] T042 [US3] Wire `usePaginatedQuery` infinite scroll (load older on scroll-up, reverse for display) in `src/features/messages/MessageList.tsx` — depends on T021, T037

**Checkpoint**: Messaging is now feature-complete per spec.md's messaging requirements.

---

## Phase 6: User Story 4 - Direct Messages Between Members (Priority: P4 in build order; P3 in spec.md)

**Goal**: Any user opens a 1-on-1 DM with a fellow server member; DMs behave like channels.

**Independent Test**: Two users sharing a server open a DM, exchange messages in real time, and
edit/delete their own messages — no server-channel or call functionality involved.

### Tests for User Story 4 ⚠️

- [X] T043 [P] [US4] convex-test: `directMessageThreads.openThread` requires a shared server and finds-or-creates on the canonical `[userAId, userBId]` pair, in `tests/convex/dmThreads.test.ts`
- [X] T044 [P] [US4] convex-test: `directMessages` send/edit/delete are thread-participant/author-only, in `tests/convex/directMessages.test.ts`

### Implementation for User Story 4

- [X] T045 [US4] Implement `convex/directMessageThreads.ts`: `openThread(otherUserId)`, `listMyThreads()`
- [X] T046 [US4] Implement `convex/directMessages.ts`: `sendDirectMessage`, `editDirectMessage`, `deleteDirectMessage`, `listDirectMessages(threadId, paginationOpts)` — depends on T045
- [X] T047 [US4] Build DM list UI in `src/features/directMessages/DMList.tsx` — depends on T045
- [X] T048 [US4] Build DM chat pane reusing `messages/` components (`ChatPane`, `MessageItem`, `Composer`, `TypingIndicator`) in `src/features/directMessages/DMChatPane.tsx` — depends on T046, T040, T041

**Checkpoint**: All text-based user stories (US1–US4) are complete and independently functional.

---

## Phase 7: User Story 5 - Voice and Video Calls (Priority: P5 in build order; P4 in spec.md)

**Goal**: Members join a voice channel to start/join a live call (2–4 participants) with
mic/camera controls, speaking/mute indicators, and channel-list presence; 1-on-1 calls can also
start from a DM.

**Independent Test**: 2 (up to 4) members join the same voice channel and confirm they see/hear
each other, can toggle mic/camera, see speaking/muted indicators, and the channel list reflects
who's connected — independent of text messaging. DM video call tested the same way.

### Tests for User Story 5 ⚠️

- [X] T049 [P] [US5] Playwright smoke test covering quickstart.md Scenario 5 (two participants join a voice channel call and connect) in `tests/e2e/join-call.spec.ts` — constitution-mandated critical-flow smoke test
- [X] T050 [P] [US5] convex-test: `calls.joinCall` rejects a 5th participant with a clear error, and `leaveCall` ends the call when the last participant leaves, in `tests/convex/calls.test.ts`
- [X] T051 [P] [US5] convex-test: `signals.sendSignal`/`listSignalsForMe`/`consumeSignal` are call-participant-only, in `tests/convex/signals.test.ts`
- [X] T052 [P] [US5] Vitest: per-pair polite/impolite tie-break (`myUserId < remoteUserId`) and ICE-candidate buffering-before-remote-description logic, in `tests/unit/webrtcMesh.test.ts`

### Implementation for User Story 5

- [X] T053 [US5] Implement `convex/calls.ts`: `joinCall(location)` (4-participant cap per FR-026), `leaveCall(callId)`, `updateParticipantState(callId, micOn?, cameraOn?, isSpeaking?)`, `listParticipants(callId)`, `listActiveCallsForServer(serverId)`
- [X] T054 [US5] Implement `convex/calls.ts`: `callHeartbeat(callId)` mutation + `sweepStaleCallParticipants` scheduled function (research.md §3a — dropped-connection handling) — depends on T053
- [X] T055 [US5] Implement `convex/signals.ts`: `sendSignal(callId, toUserId, type, payload)`, `listSignalsForMe(callId)`, `consumeSignal(signalId)`
- [X] T056 [US5] Implement `src/lib/webrtc/signaling.ts`: Convex-backed signal send/subscribe helpers with ICE-candidate buffering before `setRemoteDescription` resolves (research.md §4) — depends on T055
- [X] T057 [US5] Implement `src/lib/webrtc/usePeerConnections.ts`: full-mesh `RTCPeerConnection` management — diffs `listParticipants` to create/close connections per participant (research.md §4), runs the perfect-negotiation flow per pair with the polite/impolite tie-break, and calls `pc.restartIce()` on `iceConnectionState === "failed"` — depends on T052, T056
- [X] T058 [US5] Build the call UI: video tiles, mic/camera toggle controls, speaking/mute indicators, and a "couldn't connect" state on ICE failure, in `src/features/calls/CallView.tsx` — depends on T057
- [X] T059 [US5] Wire `callHeartbeat` on a ~5s interval while connected, in `src/features/calls/CallView.tsx` — depends on T054, T058
- [X] T060 [US5] Wire the channel list's "who's connected" indicator using `listActiveCallsForServer` in `src/features/channels/ChannelSidebar.tsx` — depends on T053
- [X] T061 [US5] Wire the 1-on-1 video call entry point from the DM chat pane in `src/features/directMessages/DMChatPane.tsx` — depends on T048, T058

**Checkpoint**: All 5 user stories are complete and independently functional — full spec scope delivered.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that span multiple user stories; no new functional scope.

- [X] T062 [P] Run every quickstart.md validation scenario manually end-to-end
- [X] T063 [P] Accessibility pass on the dark theme (contrast, focus states, keyboard nav) across `src/` — restored a visible `:focus-visible` outline globally (components use `outline-none` for custom styling, which otherwise dropped the browser's default focus indicator entirely), added `aria-label`s to icon-only buttons, and Escape-to-close + `role="dialog"` on the shared `Modal`
- [X] T064 Security review pass: confirm every `convex/*.ts` query/mutation calls one of the `authz.ts` helpers from T012, per `contracts/convex-api.md`'s auth column (constitution Principle IV) — all clear; `presence.ts`'s `list`/`disconnect` intentionally use capability tokens (`roomToken`/`sessionToken`) issued only via an authz-checked `heartbeat` call instead, exactly as documented in `contracts/convex-api.md`
- [X] T065 [P] Handle `getUserMedia` permission denial gracefully in `src/features/calls/CallView.tsx` (clear error state, not a silent failure — plan-audit finding)
- [X] T066 [P] Write `README.md` setup/run instructions (Convex dev deployment, env vars, `npm run dev`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–7)**: All depend on Foundational; listed in spec.md priority order
  (P1→P4) but each is independently testable once Foundational is done — US3/US4/US5 do not
  require each other, only the Foundational phase and (for UI reuse) specific components noted
  inline above (e.g., T048 reuses T040/T041; T061 reuses T048/T058)
- **Polish (Phase 8)**: Depends on whichever user stories are in scope for a given release

### User Story Dependencies

- **US1 (P1)**: No dependencies beyond Foundational — this is the MVP
- **US2 (P2)**: No dependencies beyond Foundational; naturally follows US1 since it extends the
  same `servers`/`channels` functions, but does not require US1's UI to exist to be tested via
  `convex-test`
- **US3 (P2)**: No dependencies beyond Foundational and US1's `messages.ts`/`ChatPane.tsx`
  (extends rather than duplicates them)
- **US4 (P3)**: No dependencies beyond Foundational; reuses US3's message UI components (T040,
  T041) for its own chat pane
- **US5 (P4)**: No dependencies beyond Foundational; reuses US4's DM chat pane (T048) only for
  its DM-call entry point (T061) — the voice-channel call path (T049–T060) has no dependency on
  US4 at all

### Within Each User Story

- Tests written first, confirmed to fail, then implementation
- Convex functions (models/services) before UI
- Story complete and independently testable before moving to the next priority

### Parallel Opportunities

- All Setup tasks marked [P] run in parallel
- T010/T011/T012 (auth, presence, authz) touch different files and can run in parallel once T009's schema is committed
- All [P] test tasks within a story phase run in parallel
- US3, US4, and US5's Convex-layer tasks (T038–T039, T045–T046, T053–T055) can be built in
  parallel by different contributors once Foundational is done, since they touch disjoint
  `convex/*.ts` files — only their UI layers have the noted cross-story reuse dependencies

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together:
Task: "Playwright smoke test in tests/e2e/send-message.spec.ts"
Task: "convex-test for servers.createServer in tests/convex/servers.test.ts"
Task: "convex-test for messages.sendMessage in tests/convex/messages.test.ts"

# Launch independent US1 Convex modules together:
Task: "Implement convex/servers.ts (createServer, listMyServers, getServer)"
Task: "Implement convex/serverMembers.ts membership helpers"
Task: "Implement convex/channels.ts listChannels"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (schema, auth, presence, authz — blocks everything)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run `tests/e2e/send-message.spec.ts` and quickstart.md Scenario 1
   manually; confirm the app builds and runs (constitution Principle V)
5. Demo if ready — this is a complete, working chat MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → validate independently → demo (MVP)
3. Add US2 → validate independently → demo (invites, multi-channel, membership mgmt)
4. Add US3 → validate independently → demo (edit/delete/typing/history)
5. Add US4 → validate independently → demo (DMs)
6. Add US5 → validate independently → demo (voice/video calls) — full spec scope complete
7. Each story adds value without breaking previous stories, per constitution Principle V (main
   branch must build and run after every story)

### Solo/Small-Team Strategy

Given this is a student project (constitution context), the realistic path is sequential
(P1→P2→P3→P4→P5) exactly as phased above, using the [P] markers within each phase to batch
independent files rather than parallelizing across stories.

---

## Notes

- [P] tasks touch different files with no unfinished dependency between them
- [Story] labels map every implementation task to its spec.md user story for traceability
- Every task lists an exact file path per `plan.md`'s Project Structure
- Tests are scoped to the constitution's actual mandate (authz coverage + 2 smoke tests) — no
  broader suite was added, per Simplicity First
- Commit after each task or logical group; stop at any checkpoint to validate a story
  independently before continuing
- Avoid: vague tasks, same-file conflicts marked [P], cross-story dependencies that would break a
  story's independent testability
