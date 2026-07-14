import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/*.ts");

async function createServerWithOwnerAndOutsider(t: ReturnType<typeof convexTest>) {
  const ownerId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: `owner-${Math.random()}@example.com`, displayName: "Owner" }),
  );
  const outsiderId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: `outsider-${Math.random()}@example.com`,
      displayName: "Outsider",
    }),
  );
  const asOwner = t.withIdentity({ subject: ownerId });
  const serverId = await asOwner.mutation(api.servers.createServer, { name: "Test Server" });
  return { ownerId, outsiderId, asOwner, asOutsider: t.withIdentity({ subject: outsiderId }), serverId };
}

test("createChannel is owner-only and creates a channel for members to see", async () => {
  const t = convexTest(schema, modules);
  const { asOwner, asOutsider, serverId } = await createServerWithOwnerAndOutsider(t);

  await expect(
    asOutsider.mutation(api.channels.createChannel, {
      serverId,
      name: "random",
      type: "text",
    }),
  ).rejects.toThrow();

  const channelId = await asOwner.mutation(api.channels.createChannel, {
    serverId,
    name: "random",
    type: "text",
  });
  const channels = await asOwner.query(api.channels.listChannels, { serverId });
  expect(channels.find((c) => c._id === channelId)?.name).toBe("random");
});

test("renameChannel is owner-only", async () => {
  const t = convexTest(schema, modules);
  const { asOwner, asOutsider, serverId } = await createServerWithOwnerAndOutsider(t);
  const channelId = await asOwner.mutation(api.channels.createChannel, {
    serverId,
    name: "random",
    type: "text",
  });

  await expect(
    asOutsider.mutation(api.channels.renameChannel, { channelId, name: "renamed" }),
  ).rejects.toThrow();

  await asOwner.mutation(api.channels.renameChannel, { channelId, name: "renamed" });
  const channels = await asOwner.query(api.channels.listChannels, { serverId });
  expect(channels.find((c) => c._id === channelId)?.name).toBe("renamed");
});

test("deleteChannel is owner-only and cascades to delete the channel's messages", async () => {
  const t = convexTest(schema, modules);
  const { asOwner, asOutsider, serverId } = await createServerWithOwnerAndOutsider(t);
  const channelId = await asOwner.mutation(api.channels.createChannel, {
    serverId,
    name: "random",
    type: "text",
  });
  await t.run(async (ctx) => {
    await ctx.db.insert("messages", {
      channelId,
      authorId: (await ctx.db.query("serverMembers").first())!.userId,
      content: "hello",
    });
  });

  await expect(asOutsider.mutation(api.channels.deleteChannel, { channelId })).rejects.toThrow();

  await asOwner.mutation(api.channels.deleteChannel, { channelId });

  const remainingMessages = await t.run(async (ctx) =>
    ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", channelId))
      .collect(),
  );
  expect(remainingMessages).toHaveLength(0);

  const channels = await asOwner.query(api.channels.listChannels, { serverId });
  expect(channels.find((c) => c._id === channelId)).toBeUndefined();
});

test("deleteChannel ends any active call for a voice channel", async () => {
  const t = convexTest(schema, modules);
  const { asOwner, ownerId, serverId } = await createServerWithOwnerAndOutsider(t);
  const channelId = await asOwner.mutation(api.channels.createChannel, {
    serverId,
    name: "voice-room",
    type: "voice",
  });

  const callId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("calls", {
      location: { kind: "voiceChannel", channelId },
      startedAt: Date.now(),
    });
    await ctx.db.insert("callParticipants", {
      callId: id,
      userId: ownerId,
      micOn: true,
      cameraOn: false,
      isSpeaking: false,
      lastHeartbeatAt: Date.now(),
    });
    return id;
  });

  await asOwner.mutation(api.channels.deleteChannel, { channelId });

  const call = await t.run(async (ctx) => ctx.db.get(callId));
  expect(call).toBeNull();
});
