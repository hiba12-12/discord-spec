<!--
Sync Impact Report
Version change: [TEMPLATE] → 1.0.0 (initial ratification)
Modified principles: N/A (initial adoption)
Added sections:
  - Core Principles: I. Simplicity First, II. Real-Time Correctness,
    III. Type Safety End-to-End, IV. Security Basics,
    V. Incremental Delivery, VI. Testable Seams
  - Additional Constraints
  - Development Workflow
  - Governance
Removed sections: none
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no changes needed (generic, constitution-driven Constitution Check gate)
  - .specify/templates/spec-template.md ✅ no changes needed (no principle-specific references)
  - .specify/templates/tasks-template.md ✅ no changes needed (task categories already support smoke-test / incremental delivery framing)
Follow-up TODOs: none
-->

# Real-Time Chat & Video App Constitution

## Core Principles

### I. Simplicity First
Prefer the smallest solution that satisfies the current spec. Do not introduce
speculative abstractions, configuration options, or generalized frameworks for
requirements that do not yet exist. Do not add libraries or dependencies beyond
those explicitly named in the approved plan. If a simpler approach meets the
spec, it MUST be chosen over a more "flexible" or "future-proof" one.

Rationale: This is a student-built project with limited time and review
bandwidth; unused flexibility is a cost (more code to understand, test, and
maintain) with no present benefit.

### II. Real-Time Correctness
The UI MUST reflect server state through reactive subscriptions (e.g.
subscription/live-query mechanisms provided by the backend). Manual polling
loops and instructions to the user to refresh the page are prohibited as a
way to observe state changes. Any view showing live data (messages, call
participants, presence) MUST update automatically when the underlying data
changes.

Rationale: This is a chat and video application; state stale by even a few
seconds (or requiring a manual refresh) breaks the core value proposition of
the product.

### III. Type Safety End-to-End
TypeScript strict mode MUST be enabled across the entire codebase (frontend
and backend). All database access MUST go through typed schema definitions —
no untyped queries, no `any`-typed database results. Types MUST flow from the
schema through backend functions to the frontend without manual re-declaration
or casting to bypass the type checker.

Rationale: End-to-end typing catches contract mismatches between client and
server at compile time instead of at runtime, which matters most in a
real-time system where bugs surface as confusing live-state glitches.

### IV. Security Basics
Every backend function MUST validate that the calling user is authenticated
and is authorized for the specific resource it touches (e.g. a user reading
or writing a message/call MUST be verified as a member of that
conversation/call). Authorization checks MUST happen inside the backend
function itself — never assumed from the UI having hidden an action, and
never deferred to a "we'll add it later" TODO.

Rationale: Chat and video data is private by nature; a missing authorization
check is a direct data-leak or impersonation vulnerability, not a cosmetic
bug.

### V. Incremental Delivery
The application MUST build and run successfully after each user story is
completed. The main branch MUST NOT be left in a broken (non-building,
non-running) state between stories. Work MUST be structured so each
completed story is a shippable increment, not a partial change that depends
on a later story to become functional.

Rationale: Incremental delivery gives continuous, honest signal on project
health and avoids large, risky integration efforts at the end of the project
timeline.

### VI. Testable Seams
Business logic MUST be separated from UI rendering code so that logic can be
tested without a rendered UI (e.g. pure functions, backend functions callable
directly). Critical user flows — at minimum, sending a message and joining a
call — MUST have at least one smoke test verifying the flow works end-to-end.

Rationale: A hard separation between logic and presentation is what makes
testing practical at all for a small student team, and smoke tests on the two
core flows catch the regressions that would hurt users most.

## Additional Constraints

- Frontend and backend code MUST use TypeScript in strict mode; no `// @ts-ignore`
  or `any` used to silence type errors without an inline justification comment.
- New dependencies MUST be listed and justified in the feature's implementation
  plan before use; ad hoc `npm install` of unplanned packages during
  implementation is not permitted.
- Real-time features (messaging, presence, call state) MUST use the project's
  chosen reactive/subscription data layer rather than a bespoke polling
  mechanism.

## Development Workflow

- Every feature follows the spec → plan → tasks → implement flow; user
  stories within a feature are implemented and merged one at a time.
- Before a user story is considered done, the app MUST build, MUST run, and
  the story's smoke test (if it is a critical flow) MUST pass.
- Code reviews (self-review is acceptable for a solo/student team) MUST
  confirm: no unapproved dependencies were added, authorization checks exist
  on new backend functions, and strict-mode type checking passes.

## Governance

This constitution supersedes ad hoc practices and prior informal conventions
for this project. Amendments require:

1. A documented reason for the change (what problem the current principle
   set does not address).
2. An update to this file, including the Sync Impact Report header.
3. A version bump following semantic versioning: MAJOR for removal or
   incompatible redefinition of a principle, MINOR for adding a new principle
   or materially expanding guidance, PATCH for clarifications and wording
   fixes.

All plans and task lists MUST include a Constitution Check confirming
compliance with these principles before implementation begins; any
deviation MUST be explicitly justified in the plan's Complexity Tracking
section or equivalent.

**Version**: 1.0.0 | **Ratified**: 2026-07-14 | **Last Amended**: 2026-07-14
