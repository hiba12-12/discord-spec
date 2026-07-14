import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/*.ts");

async function setupChannelWithTwoMembers(t: ReturnType<typeof convexTest>) {
  const ownerId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: `owner-${Math.random()}@example.com`, displayName: "Owner" }),
  );
  const otherId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: `other-${Math.random()}@example.com`, displayName: "Other" }),
  );
  const asOwner = t.withIdentity({ subject: ownerId });
  const asOther = t.withIdentity({ subject: otherId });
  const serverId = await asOwner.mutation(api.servers.createServer, { name: "Test Server" });
  const { server } = await asOwner.query(api.servers.getServer, { serverId });
  await asOther.mutation(api.servers.joinByInvite, { inviteCode: server.inviteCode });
  const channels = await asOwner.query(api.channels.listChannels, { serverId });
  const channelId = channels[0]!._id;
  return { asOwner, asOther, channelId };
}

test("setTyping shows up for other members, not for the typer themself", async () => {
  const t = convexTest(schema, modules);
  const { asOwner, asOther, channelId } = await setupChannelWithTwoMembers(t);

  await asOwner.mutation(api.typingIndicators.setTyping, {
    scope: { kind: "channel", channelId },
  });

  const otherView = await asOther.query(api.typingIndicators.listTypingUsers, {
    scope: { kind: "channel", channelId },
  });
  expect(otherView.map((u) => u.displayName)).toContain("Owner");

  const ownerView = await asOwner.query(api.typingIndicators.listTypingUsers, {
    scope: { kind: "channel", channelId },
  });
  expect(ownerView).toHaveLength(0);
});

test("clearTyping removes the indicator immediately", async () => {
  const t = convexTest(schema, modules);
  const { asOwner, asOther, channelId } = await setupChannelWithTwoMembers(t);

  await asOwner.mutation(api.typingIndicators.setTyping, {
    scope: { kind: "channel", channelId },
  });
  await asOwner.mutation(api.typingIndicators.clearTyping, {
    scope: { kind: "channel", channelId },
  });

  const otherView = await asOther.query(api.typingIndicators.listTypingUsers, {
    scope: { kind: "channel", channelId },
  });
  expect(otherView).toHaveLength(0);
});

test("listTypingUsers filters out stale rows past the freshness window", async () => {
  const t = convexTest(schema, modules);
  const { asOther, channelId } = await setupChannelWithTwoMembers(t);

  await t.run(async (ctx) => {
    const ownerId = (await ctx.db.query("serverMembers").first())!.userId;
    await ctx.db.insert("typingIndicators", {
      scope: { kind: "channel", channelId },
      userId: ownerId,
      lastTypedAt: Date.now() - 10_000,
    });
  });

  const otherView = await asOther.query(api.typingIndicators.listTypingUsers, {
    scope: { kind: "channel", channelId },
  });
  expect(otherView).toHaveLength(0);
});
