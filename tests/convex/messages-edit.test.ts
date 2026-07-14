import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/*.ts");

async function setupChannelWithMessage(t: ReturnType<typeof convexTest>) {
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
  const messageId = await asOwner.mutation(api.messages.sendMessage, {
    channelId,
    content: "hello",
  });
  return { asOwner, asOther, channelId, messageId };
}

test("editMessage is author-only and marks the message as edited", async () => {
  const t = convexTest(schema, modules);
  const { asOwner, asOther, channelId, messageId } = await setupChannelWithMessage(t);

  await expect(
    asOther.mutation(api.messages.editMessage, { messageId, content: "hacked" }),
  ).rejects.toThrow();

  await asOwner.mutation(api.messages.editMessage, { messageId, content: "edited hello" });
  const page = await asOwner.query(api.messages.listMessages, {
    channelId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  const message = page.page.find((m) => m._id === messageId);
  expect(message?.content).toBe("edited hello");
  expect(message?.editedAt).not.toBeUndefined();
});

test("deleteMessage is author-only and removes the message", async () => {
  const t = convexTest(schema, modules);
  const { asOwner, asOther, channelId, messageId } = await setupChannelWithMessage(t);

  await expect(
    asOther.mutation(api.messages.deleteMessage, { messageId }),
  ).rejects.toThrow();

  await asOwner.mutation(api.messages.deleteMessage, { messageId });
  const page = await asOwner.query(api.messages.listMessages, {
    channelId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(page.page.find((m) => m._id === messageId)).toBeUndefined();
});
