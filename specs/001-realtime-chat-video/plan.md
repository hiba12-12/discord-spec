# Implementation Plan: Real-Time Chat & Video Calling Application

**Branch**: `001-realtime-chat-video` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-realtime-chat-video/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

A Discord-like real-time chat and video calling app: users sign up, create/join servers via
invite link, chat in real-time text channels and DMs, and join up to 4-participant voice/video
calls in voice channels or 1-on-1 from a DM. Technical approach: a Vite + React 18 + TypeScript
SPA talks to Convex (typed schema, reactive queries, mutations) for all data and auth (Convex
Auth, password provider); typing indicators and presence are Convex tables updated by heartbeat
and swept by scheduled functions; voice/video uses native WebRTC in a full-mesh topology (≤4
peers) with STUN-only ICE and signaling relayed through a Convex `signals` table (no
Socket.io/LiveKit/Twilio).

## Technical Context

**Language/Version**: TypeScript 5.x, strict mode, Node.js 20+ (for Convex dev/build tooling)

**Primary Dependencies**: React 18, Vite, React Router, Tailwind CSS, Convex (`convex@1.42.1`,
`@convex-dev/auth@0.0.94` + peer `@auth/core@0.41.1`, `@convex-dev/presence@0.3.2`), native
browser `RTCPeerConnection`/`MediaStream` APIs (no WebRTC SDK)

**Storage**: Convex (document tables defined in `convex/schema.ts`); no separate database

**Testing**: Vitest + React Testing Library for frontend unit/component logic; `convex-test` for
Convex query/mutation unit tests; Playwright for the two constitution-mandated critical-flow
smoke tests (send a message, join a call)

**Target Platform**: Modern evergreen desktop browsers (Chrome/Edge/Firefox/Safari) with WebRTC
support; responsive layout only, no native mobile app (out of scope per spec)

**Project Type**: Web application — single repo, Vite SPA at the root + `convex/` backend
functions (Option 2 "web application" shape collapsed into one repo, since Convex functions are
not a separately deployed server project)

**Performance Goals**: Message delivery to viewers within 1s (SC-002); call state changes visible
within 2s (SC-005); presence/typing reflect real state within 3s (SC-006); message history page
loads within 1s at 10k+ messages (SC-007)

**Constraints**: STUN-only ICE (no TURN) — calls may fail to connect across strict/symmetric NAT;
documented as a known v1 limitation, not silently hidden. Full-mesh WebRTC caps call size at 4
participants (bandwidth/CPU scale as O(n²) connections). No polling anywhere (constitution
Principle II) — all live views must be Convex `useQuery` subscriptions.

**Scale/Scope**: Up to a few hundred members per server, low thousands of registered users
system-wide (SC-008); 5 user stories, ~12 Convex tables, single SPA with ~6 top-level views
(auth, server rail, channel sidebar, chat pane, member list, call view)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Simplicity First | Dependency list is fixed to React, Vite, React Router, Tailwind, Convex, `@convex-dev/auth`. No WebRTC SDK, no state-management library, no UI kit — native browser APIs and Convex's own reactivity replace them. | PASS |
| II. Real-Time Correctness | All live data (messages, presence, typing, call roster, signaling) flows through Convex `useQuery` subscriptions; no polling loops or "refresh to see updates" anywhere in the design. | PASS |
| III. Type Safety End-to-End | TypeScript strict mode on both the Vite app and `convex/` functions; `convex/schema.ts` is the single typed source of truth, and Convex generates typed client APIs from it — no untyped DB access is possible by construction. | PASS |
| IV. Security Basics | Every Convex query/mutation touching a server, channel, message, DM, or call must re-check membership/authorship server-side via `ctx.auth` + a membership lookup, documented per-function in `contracts/convex-api.md`. | PASS (verify per-function during implementation) |
| V. Incremental Delivery | Project structure and task breakdown (next command) follow the spec's 5 prioritized user stories, each independently buildable/runnable/shippable. | PASS |
| VI. Testable Seams | Convex functions are plain callable business logic, testable via `convex-test` without rendering UI; Playwright smoke tests cover "send a message" (US1) and "join a call" (US5) end-to-end per constitution mandate. | PASS |

No violations requiring Complexity Tracking justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-realtime-chat-video/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── convex-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
convex/
├── convex.config.ts           # registers the @convex-dev/presence component
├── schema.ts                  # All table definitions + indexes (single typed source of truth);
│                               # `users` is `authTables.users` inlined + extended, no separate
│                               # profile table (research.md §1)
├── auth.ts                    # convexAuth() config: Password provider + profile callback
│                               # (writes displayName/avatarUrl at signup); exports the
│                               # Convex-Auth-provided signIn/signOut/store/isAuthenticated —
│                               # there are NO custom signUp/logIn mutations (research.md §1)
├── auth.config.ts
├── users.ts                   # updateProfile, getCurrentUser, checkLoginAllowed,
│                               # recordLoginResult (FR-001a rate-limit check/record pair the
│                               # client calls around Convex Auth's own signIn — see
│                               # contracts/convex-api.md for why this is client-enforced, not a
│                               # hook inside Convex Auth's action)
├── presence.ts                 # thin wrapper around @convex-dev/presence: heartbeat/list/
│                                # disconnect, with our own server-membership auth check layered
│                                # on top (research.md §2 — no custom presence table)
├── servers.ts                  # create/rename server, invite link generate/consume
├── serverMembers.ts            # membership queries, remove member
├── channels.ts                  # create/rename/delete text+voice channels
├── messages.ts                  # send/edit/delete + paginated channel history query
├── directMessageThreads.ts      # open/list DM threads
├── directMessages.ts            # send/edit/delete DM messages
├── typingIndicators.ts          # set/clear typing, query active typers, scheduled stale-sweep
├── calls.ts                      # join/leave voice channel or DM call, participant roster query,
│                                  # callHeartbeat mutation + sweepStaleCallParticipants scheduled
│                                  # function (handles dropped connections, data-model.md
│                                  # callParticipants lifecycle)
├── signals.ts                     # write/subscribe WebRTC signaling payloads, cleanup after consume
└── lib/
    └── authz.ts                    # shared membership/ownership/authorship check helpers

src/
├── main.tsx
├── App.tsx                     # React Router route tree
├── routes/
│   ├── LoginPage.tsx
│   ├── SignupPage.tsx
│   └── ServerLayout.tsx         # server rail + channel sidebar + outlet
├── features/
│   ├── auth/                    # signup/login forms, session hook
│   ├── servers/                  # server rail, create/join-by-invite, rename, member list
│   ├── channels/                  # channel sidebar, create/rename/delete channel dialogs
│   ├── messages/                   # chat pane, message list (infinite scroll), composer, typing indicator
│   ├── directMessages/              # DM list, DM chat pane (reuses messages/ components)
│   ├── presence/                     # online/offline dot using @convex-dev/presence/react's usePresence
│   └── calls/                         # voice channel call UI, video tiles, mic/camera controls, WebRTC
│                                        # peer manager (diffs listParticipants to create/close
│                                        # RTCPeerConnections per participant, sends callHeartbeat)
├── lib/
│   ├── convexClient.ts
│   └── webrtc/
│       ├── usePeerConnections.ts     # full-mesh RTCPeerConnection management
│       └── signaling.ts               # Convex-backed signal send/subscribe helpers
└── styles/
    └── index.css                       # Tailwind entrypoint + Discord-like dark theme tokens

tests/
├── unit/                                # Vitest: pure logic, hooks (webrtc mesh bookkeeping, formatting)
├── convex/                               # convex-test: query/mutation authz + business rules
└── e2e/                                   # Playwright: send-message smoke test, join-call smoke test

.env.local                                # Convex deployment URL + auth secrets (never committed)
vite.config.ts
tailwind.config.ts
tsconfig.json
```

**Structure Decision**: Single repository, no `backend/`/`frontend/` split. Vite SPA lives at the
repo root (`src/`) and Convex functions live in `convex/`, matching the user-specified structure
("Vite app at the root, Convex functions in `convex/`"). This is simpler than a two-package
monorepo because Convex functions aren't a separately hosted server — the Convex CLI deploys them
directly, and the Vite app imports generated types from `convex/_generated` directly across the
one repo boundary.

## Complexity Tracking

*No Constitution Check violations — table intentionally left empty.*
