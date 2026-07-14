# Feature Specification: Real-Time Chat & Video Calling Application

**Feature Branch**: `001-realtime-chat-video`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Build a real-time chat and video calling application modeled on Discord. Users & auth: Users sign up and log in. Each user has a display name and avatar. A user's online/offline status is visible to others. Servers: A logged-in user can create a server (a named community with an optional image). The creator becomes its owner. Users join servers via an invite link the owner can generate. A server lists its members and their online status in a sidebar. Owners can rename the server and remove members. Channels: Every server starts with a default \"general\" text channel. Members can see all channels; the owner can create, rename, and delete text channels and voice channels. Deleting a channel removes its messages. Messaging: Inside a text channel, members send text messages. Messages appear for all members in real time without refreshing. Each message shows author name, avatar, timestamp, and content. Authors can edit and delete their own messages; edits are marked. Messages load newest-first with infinite scroll for history. Typing indicators show when someone is composing. Direct messages: Any user can open a 1-on-1 DM conversation with another member of a shared server. DMs behave like channels (real time, edit, delete). Voice/video calls: A member can join a voice channel, which starts or joins a live call with the other members currently in that channel (support at least 2, target up to 4 participants). Participants can toggle their microphone and camera, see each other's video tiles, see who is speaking/muted, and leave the call. The channel list shows who is currently connected to each voice channel. 1-on-1 video calls can also be started from a DM. Out of scope for v1: message attachments/files, reactions, threads, roles/permissions beyond owner vs member, screen sharing, mobile apps, message search."

## Clarifications

### Session 2026-07-14

- Q: Are user display names required to be unique across the system? → A: No — display names are not unique; users are distinguished internally by account ID, and duplicate display names may coexist.
- Q: What scale should the system target? → A: Moderate scale — up to a few hundred members per server, low thousands of total registered users system-wide.
- Q: Is there a maximum length for a text message? → A: Yes — 2,000 characters max per message.
- Q: What happens after repeated failed login attempts? → A: Rate-limit login attempts (temporary delay/lockout after several consecutive failures); no CAPTCHA or external service required.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign Up, Create a Server, and Chat in Real Time (Priority: P1)

A new user signs up, creates a server, and sends text messages that other members see instantly in the server's default channel, without needing to refresh the page.

**Why this priority**: This is the core value loop of the product — an account, a place to talk, and real-time text messaging. Without this, nothing else in the app has a reason to exist.

**Independent Test**: Can be fully tested by signing up two accounts, having one create a server and share the default channel, having both join, and confirming messages sent by either appear for both in real time. Delivers a complete, demonstrable chat MVP on its own.

**Acceptance Scenarios**:

1. **Given** no account exists, **When** a person signs up with a display name and credentials, **Then** an account is created, they are logged in, and they can set an avatar.
2. **Given** a logged-in user with an existing account, **When** they change their display name or avatar image, **Then** the update is saved and reflected to other members who share a server with them.
3. **Given** a logged-in user, **When** they create a server with a name, **Then** the server is created, they become its owner, and a default "general" text channel is ready to use.
4. **Given** two members in the same server's general channel, **When** one member sends a text message, **Then** the other member sees the message appear immediately, showing the author's name, avatar, timestamp, and content, without refreshing the page.
5. **Given** a user is logged in, **When** they close and reopen the app, **Then** they remain logged in and see the servers they belong to.
6. **Given** other members are online, **When** a user views the server sidebar, **Then** they see each member's current online/offline status.

---

### User Story 2 - Grow a Server with Invites, Channels, and Membership Management (Priority: P2)

The server owner invites others via a shareable link, organizes conversation into multiple text and voice channels, and manages membership (renaming the server, creating/renaming/deleting channels, removing members).

**Why this priority**: A server with only one channel and no way to invite people has no path to becoming a real community. This story turns the P1 MVP into a usable multi-person space.

**Independent Test**: Can be fully tested by having an owner generate an invite link, a second user joining via that link, the owner creating and renaming additional text/voice channels, and the owner removing a member — all independent of DMs or calls.

**Acceptance Scenarios**:

1. **Given** a server owner, **When** they generate an invite link, **Then** any user who opens that link and accepts joins the server as a member.
2. **Given** a server with members, **When** any member opens the server, **Then** they see the full list of text and voice channels and the member list with online/offline status.
3. **Given** a server owner, **When** they create a new text or voice channel, **Then** the channel appears for all members immediately.
4. **Given** a server owner, **When** they rename the server, a channel, **Then** the new name is reflected for all members.
5. **Given** a server owner, **When** they delete a text channel, **Then** the channel and all of its messages are removed and no longer accessible to members.
6. **Given** a server owner, **When** they remove a member from the server, **Then** that member loses access to the server's channels.
7. **Given** a non-owner member, **When** they attempt to rename/delete a channel, rename the server, or remove a member, **Then** the action is rejected.

---

### User Story 3 - Rich Message Editing and History (Priority: P2)

Members edit or delete their own messages, see typing indicators while others compose, and scroll back through message history that loads incrementally as they scroll up.

**Why this priority**: These are expected baseline chat behaviors; without them the messaging experience feels incomplete compared to the Discord-like product being modeled, but the app is still usable without them (covered by US1).

**Independent Test**: Can be fully tested within a single channel already covered by US1 — send a message, edit it, delete it, observe a typing indicator from another simulated user, and scroll up through enough history to trigger incremental loading.

**Acceptance Scenarios**:

1. **Given** a member sent a message, **When** they edit its content, **Then** all members see the updated content marked as edited.
2. **Given** a member sent a message, **When** they delete it, **Then** the message is removed from the channel for all members.
3. **Given** a member is not the author of a message, **When** they attempt to edit or delete it, **Then** the action is rejected.
4. **Given** a member is typing in a channel, **When** other members are viewing that channel, **Then** they see a typing indicator for that member, which disappears shortly after typing stops or a message is sent.
5. **Given** a channel has more messages than fit on screen, **When** a member scrolls up, **Then** older messages load incrementally (infinite scroll) with newest messages shown first by default.

---

### User Story 4 - Direct Messages Between Members (Priority: P3)

Any user opens a 1-on-1 direct message conversation with another member of a server they share, and that conversation behaves like a channel: real-time delivery, editing, and deletion.

**Why this priority**: Adds private one-on-one communication alongside server channels. It depends conceptually on having servers/members (US1/US2) but is functionally independent of channel management and calls.

**Independent Test**: Can be fully tested by two users who share a server opening a DM with each other, exchanging messages in real time, and editing/deleting their own messages — with no server-channel or call functionality involved.

**Acceptance Scenarios**:

1. **Given** two users share at least one server, **When** one opens a DM with the other, **Then** a private 1-on-1 conversation is created (or reopened if it already exists).
2. **Given** an open DM conversation, **When** one participant sends a message, **Then** the other participant sees it appear in real time with author, avatar, timestamp, and content.
3. **Given** a DM message, **When** its author edits or deletes it, **Then** the change is reflected for both participants, consistent with channel message behavior.
4. **Given** two users do not share any server, **When** one attempts to open a DM with the other, **Then** the action is rejected.

---

### User Story 5 - Voice and Video Calls (Priority: P4)

A member joins a voice channel to start or join a live audio/video call with other members currently in that channel, or starts a 1-on-1 video call directly from a DM.

**Why this priority**: Voice/video is the most technically demanding piece and the least essential to prove the product's core chat value; it is the capstone feature layered on top of a working server/channel/DM foundation.

**Independent Test**: Can be fully tested by having 2 (up to 4) members join the same voice channel and confirming each sees/hears the others, can toggle mic/camera, sees speaking/muted indicators, and that the channel list reflects who is connected — independently of text messaging behavior. The DM video call path is tested the same way between two DM participants.

**Acceptance Scenarios**:

1. **Given** a voice channel with no active call, **When** a member joins it, **Then** a new call starts and the member is connected with their microphone on and camera off by default (or per reasonable default — see Assumptions).
2. **Given** a voice channel with an active call, **When** another member joins (up to a 4th participant), **Then** they connect to the same call and all participants see/hear each other.
3. **Given** a participant in a call, **When** they toggle their microphone or camera, **Then** other participants immediately see the updated mute/video state on that participant's tile.
4. **Given** a participant is speaking, **When** other participants view the call, **Then** that participant's tile indicates they are currently speaking.
5. **Given** a member is viewing the channel list, **When** any members are connected to a voice channel, **Then** the channel list shows who is currently connected to that channel.
6. **Given** a participant in a call, **When** they leave, **Then** they are disconnected and removed from other participants' views, and the call ends when the last participant leaves.
7. **Given** an open DM, **When** one participant starts a video call, **Then** the other participant can join a 1-on-1 call with the same mic/camera/leave controls as a voice channel call.
8. **Given** a voice channel call already at 4 connected participants, **When** a 5th member attempts to join, **Then** the join is rejected and that member sees a clear "channel is full" message.

---

### Edge Cases

- What happens when the last member (the owner) tries to leave or the owner account is deleted? (Out of scope for v1 to design ownership transfer; assume the owner cannot leave their own server in v1 — see Assumptions.)
- What happens when a 5th member attempts to join a voice channel already at the 4-participant target? System MUST prevent the join and inform the user the channel is full.
- What happens when a member's connection drops mid-call? They MUST be shown as disconnected/removed from the call for other participants within a short delay, and can rejoin if the call is still active.
- What happens when an invite link is used after the server or the inviting owner's account no longer exists? The join attempt MUST fail with a clear error.
- What happens when a member is removed from a server while they are actively viewing it or connected to a voice channel in it? They MUST lose access to its channels and be disconnected from any active call in that server.
- What happens when two members try to edit/delete the same message concurrently, or a channel is deleted while a member is actively typing in it? The system MUST resolve without data corruption (e.g., last consistent state wins; in-flight actions on a deleted channel fail gracefully).
- How does the system handle a user opening the same account in two places at once (two devices/tabs)? Both sessions MUST see consistent real-time state, and online status reflects "online" if at least one session is active.
- What happens when a user repeatedly enters the wrong password? After several consecutive failed attempts, the system MUST temporarily delay/lock out further login attempts for that account before allowing retries.

## Requirements *(mandatory)*

### Functional Requirements

**Accounts & presence**

- **FR-001**: System MUST allow a person to sign up for an account with a display name and credentials, and to log in on subsequent visits.
- **FR-001a**: System MUST rate-limit login attempts, imposing a temporary delay/lockout after several consecutive failed attempts for the same account.
- **FR-002**: System MUST allow a logged-in user to set/change an avatar image and display name.
- **FR-003**: System MUST track and display each user's online/offline status to other users who share a server with them.

**Servers**

- **FR-004**: System MUST allow a logged-in user to create a server with a name and optional image; the creator becomes the server's owner.
- **FR-005**: System MUST provision every new server with a default text channel named "general".
- **FR-006**: System MUST allow a server owner to generate an invite link that grants server membership to any user who uses it.
- **FR-007**: System MUST display, for every member of a server, the list of fellow members and their online/offline status.
- **FR-008**: System MUST allow a server owner to rename the server.
- **FR-009**: System MUST allow a server owner to remove a member from the server, revoking that member's access to the server's channels and calls.
- **FR-010**: System MUST restrict server rename and member removal to the server's owner.

**Channels**

- **FR-011**: System MUST allow all members of a server to view the server's full list of text and voice channels.
- **FR-012**: System MUST allow a server owner to create, rename, and delete text channels and voice channels.
- **FR-013**: System MUST delete all messages belonging to a text channel when that channel is deleted.
- **FR-014**: System MUST restrict channel creation, rename, and deletion to the server's owner.

**Messaging**

- **FR-015**: System MUST allow a member to send a text message in any text channel they can access, up to a maximum of 2,000 characters per message; System MUST reject messages exceeding this length with a clear error.
- **FR-016**: System MUST deliver new messages to all members currently viewing a channel in real time, without requiring a page refresh.
- **FR-017**: System MUST display, for each message, the author's display name and avatar, a timestamp, and the message content.
- **FR-018**: System MUST allow a message's author to edit its content, and MUST mark edited messages as edited for all viewers.
- **FR-019**: System MUST allow a message's author to delete their own message, removing it for all viewers.
- **FR-020**: System MUST prevent members from editing or deleting messages they did not author.
- **FR-021**: System MUST load channel message history newest-first and support loading older messages incrementally as a member scrolls back (infinite scroll).
- **FR-022**: System MUST show other members a typing indicator when a member is actively composing a message in a channel, and MUST clear it shortly after typing stops or the message is sent.

**Direct messages**

- **FR-023**: System MUST allow a user to open a 1-on-1 direct message conversation with another user only if they share at least one server.
- **FR-024**: System MUST apply the same real-time delivery, edit, and delete behavior to direct messages as to channel messages.

**Voice/video calls**

- **FR-025**: System MUST allow a member to join a voice channel, starting a live call if none is active or joining the existing one if it is.
- **FR-026**: System MUST support at least 2 and up to 4 simultaneous participants in a single voice/video call, and MUST reject additional joins beyond the supported maximum with a clear message.
- **FR-027**: System MUST allow call participants to independently toggle their own microphone and camera on/off.
- **FR-028**: System MUST show each participant their own and other participants' current video tile (or an avatar/placeholder when camera is off), and each participant's current mute state and speaking activity.
- **FR-029**: System MUST show, in the channel list, which members are currently connected to each voice channel.
- **FR-030**: System MUST allow a participant to leave a call at any time, and MUST end the call when its last participant leaves.
- **FR-031**: System MUST allow either participant in an open DM conversation to start a 1-on-1 video call with the same controls (mic/camera toggle, speaking/mute indicators, leave) as a voice-channel call.

### Key Entities

- **User**: An account with credentials, a display name (not required to be unique — users are distinguished internally by account ID), an avatar, and an online/offline presence status.
- **Server**: A named community with an optional image, one owner (a User), and a set of members.
- **Membership**: The relationship between a User and a Server they belong to (server owners are also members).
- **Channel**: A named text or voice channel belonging to exactly one Server; text channels contain Messages, voice channels host Calls.
- **Message**: Content authored by a User in a Channel or a DM Conversation, with a timestamp, edited flag, and independent edit/delete lifecycle.
- **DM Conversation**: A private 1-on-1 conversation between two Users who share at least one Server, containing Messages.
- **Call**: A live voice/video session tied to either a voice Channel or a DM Conversation, with 2–4 connected Participants.
- **Call Participant**: A User's presence within a Call, including their mute/camera state and speaking activity.
- **Invite Link**: A shareable token generated by a Server owner that grants Server membership when used.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can sign up, create a server, and send their first message in under 3 minutes.
- **SC-002**: A message sent by one member appears for other members currently viewing the channel within 1 second under normal network conditions.
- **SC-003**: A new member can join a server via an invite link and see its channels and message history within 5 seconds of clicking the link.
- **SC-004**: 95% of users can locate and use core actions (send/edit/delete a message, join a voice channel, start a DM) without external help on first attempt.
- **SC-005**: A voice/video call supports 4 simultaneous participants with each participant's audio/video and mute/speaking state visible to the others within 2 seconds of a change.
- **SC-006**: Online/offline status and typing indicators reflect a user's actual state (connected, disconnected, or typing) within 3 seconds across all viewers.
- **SC-007**: Scrolling to load older message history returns the next batch of messages within 1 second for a channel with at least 10,000 historical messages.
- **SC-008**: The system supports servers with up to a few hundred members each and a total of low thousands of registered users system-wide without user-visible degradation.

## Assumptions

- Authentication uses standard email/password sign-up and login; no third-party single sign-on (SSO) is required for v1.
- Invite links do not expire and can be reused by multiple people unless/until the owner deletes the server; per-use or time-limited invites are not required for v1.
- A server owner cannot leave or be removed from their own server in v1, and ownership transfer/deletion flows beyond what's described are out of scope; a server can be deleted by its owner as an implicit consequence of this constraint being revisited in a future version if needed.
- Newly joined call participants default to microphone on and camera off, matching common voice-chat app conventions; users can toggle either at any time.
- Message and call history is retained indefinitely in v1; no automatic retention/expiry policy is required.
- "Real time" delivery means clients automatically reflect server-side state changes (new/edited/deleted messages, membership, presence, call state) as they happen, with no manual refresh or client-side polling required.
- Out of scope for v1 (per input): message attachments/files, reactions, threads, roles/permissions beyond owner vs. member, screen sharing, native mobile apps, and message search.
