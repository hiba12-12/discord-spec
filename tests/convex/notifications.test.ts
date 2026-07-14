import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/*.ts");

test("listMyRecentActivity surfaces a new channel message from another member, not from myself", async () => {
  const t = convexTest(schema, modules);

  const ownerId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "owner@example.com", displayName: "Owner" }),
  );
  const memberId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "member@example.com", displayName: "Member" }),
  );
  const asOwner = t.withIdentity({ subject: ownerId });
  const asMember = t.withIdentity({ subject: memberId });

  const serverId = await asOwner.mutation(api.servers.createServer, { name: "Test Server" });
  const { server } = await asOwner.query(api.servers.getServer, { serverId });
  await asMember.mutation(api.servers.joinByInvite, { inviteCode: server.inviteCode });
  const channels = await asOwner.query(api.channels.listChannels, { serverId });
  const channelId = channels[0]!._id;

  const since = Date.now() - 1000;

  await asOwner.mutation(api.messages.sendMessage, { channelId, content: "hello from owner" });

  const memberEvents = await asMember.query(api.notifications.listMyRecentActivity, { since });
  expect(memberEvents).toHaveLength(1);
  expect(memberEvents[0]?.type).toBe("message");
  expect(memberEvents[0]?.authorDisplayName).toBe("Owner");

  const ownerEvents = await asOwner.query(api.notifications.listMyRecentActivity, { since });
  expect(ownerEvents).toHaveLength(0);
});

test("listMyRecentActivity excludes messages sent before `since`", async () => {
  const t = convexTest(schema, modules);

  const ownerId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "owner2@example.com", displayName: "Owner" }),
  );
  const memberId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "member2@example.com", displayName: "Member" }),
  );
  const asOwner = t.withIdentity({ subject: ownerId });
  const asMember = t.withIdentity({ subject: memberId });

  const serverId = await asOwner.mutation(api.servers.createServer, { name: "Test Server" });
  const { server } = await asOwner.query(api.servers.getServer, { serverId });
  await asMember.mutation(api.servers.joinByInvite, { inviteCode: server.inviteCode });
  const channels = await asOwner.query(api.channels.listChannels, { serverId });
  const channelId = channels[0]!._id;

  await asOwner.mutation(api.messages.sendMessage, { channelId, content: "old message" });

  const futureSince = Date.now() + 1000;
  const events = await asMember.query(api.notifications.listMyRecentActivity, {
    since: futureSince,
  });
  expect(events).toHaveLength(0);
});

test("listMyRecentActivity surfaces an incoming voice channel call for a non-participant", async () => {
  const t = convexTest(schema, modules);

  const ownerId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "owner3@example.com", displayName: "Owner" }),
  );
  const memberId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "member3@example.com", displayName: "Member" }),
  );
  const asOwner = t.withIdentity({ subject: ownerId });
  const asMember = t.withIdentity({ subject: memberId });

  const serverId = await asOwner.mutation(api.servers.createServer, { name: "Test Server" });
  const { server } = await asOwner.query(api.servers.getServer, { serverId });
  await asMember.mutation(api.servers.joinByInvite, { inviteCode: server.inviteCode });
  const channelId = await asOwner.mutation(api.channels.createChannel, {
    serverId,
    name: "voice-room",
    type: "voice",
  });

  const since = Date.now() - 1000;
  await asOwner.mutation(api.calls.joinCall, { location: { kind: "voiceChannel", channelId } });

  const memberEvents = await asMember.query(api.notifications.listMyRecentActivity, { since });
  expect(memberEvents).toHaveLength(1);
  expect(memberEvents[0]?.type).toBe("call");

  const ownerEvents = await asOwner.query(api.notifications.listMyRecentActivity, { since });
  expect(ownerEvents).toHaveLength(0);
});
