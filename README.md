# discord-spec

A real-time chat and video calling application modeled on Discord, built with React + Vite and
[Convex](https://convex.dev) as the reactive backend.

## Features

- **Accounts & presence** — email/password sign-up and login, online/offline status, a manual
  "appear offline" toggle.
- **Servers** — create servers, invite links, member list, owner-only rename/remove-member.
- **Channels** — text and voice channels, owner-only create/rename/delete.
- **Messaging** — real-time text messages with author/timestamp, edit/delete, typing indicators,
  infinite-scroll history.
- **Direct messages** — 1-on-1 DMs with any shared-server member, same real-time/edit/delete
  behavior as channels.
- **Voice & video calls** — full-mesh WebRTC calls (up to 4 participants) in voice channels or
  from a DM, with mic/camera toggles and speaking/mute indicators.
- **Notifications** — in-app toasts and browser notifications for new messages and incoming
  calls in conversations you're not currently viewing.

See `specs/001-realtime-chat-video/` for the full feature spec, data model, and task breakdown
(this project was built using the [spec-kit](https://github.com/github/spec-kit) workflow).

## Tech stack

- **Frontend**: React 18, Vite, TypeScript, React Router, Tailwind CSS
- **Backend**: Convex (reactive database + serverless functions), `@convex-dev/auth` (Password
  provider), `@convex-dev/presence`
- **Calls**: Native WebRTC (full mesh, perfect-negotiation pattern), no third-party SFU
- **Testing**: Vitest (unit + `convex-test` for backend logic), Playwright (e2e smoke tests)

## Prerequisites

- Node.js 20+
- A [Convex account](https://convex.dev) is optional for local development (an anonymous local
  deployment works out of the box), but recommended if you want your dev data to persist beyond
  this machine or plan to deploy to production later.

## Setup

```bash
npm install
```

Start the Convex backend. This will prompt you to either continue anonymously (local-only,
no account needed) or log in with a Convex account, and will write `.env.local` for you with
`VITE_CONVEX_URL`:

```bash
npx convex dev
```

**Keep this running in its own terminal** — it also watches `convex/*.ts` and pushes function
changes automatically as you edit them.

In a second terminal, run the Convex Auth setup (generates the JWT keys the backend needs and
sets them as Convex environment variables):

```bash
npx @convex-dev/auth --web-server-url http://localhost:5173
```

Then start the frontend dev server:

```bash
npm run dev
```

Open http://localhost:5173, sign up, and start creating servers.

## Running tests

```bash
npm run test:unit    # Vitest unit tests (pure logic, e.g. WebRTC mesh helpers)
npm run test:convex  # convex-test — backend query/mutation logic against a real schema
npm run test:e2e     # Playwright smoke tests (requires the dev server running)
```

## Notes

- Voice/video calls use `getUserMedia`, which requires the page be served over **HTTPS or
  localhost** — `http://localhost:5173` in dev satisfies this.
- Testing two participants in the same call on **one machine** with **one physical webcam** will
  hit a real OS/driver limitation (only one process can hold the camera at a time) — the app
  degrades gracefully (joins with whatever media is available), but for genuine two-way
  video/audio testing use either two separate devices, or two tabs of the *same* browser (which
  can often share one camera internally), or virtual camera software (e.g. OBS Virtual Camera).
