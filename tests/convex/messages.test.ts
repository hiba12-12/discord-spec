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
  const channels = await asOwner.query(api.channels.listChannels, { serverId });
  const channelId = channels[0]!._id;
  return {
    asOwner,
    asOutsider: t.withIdentity({ subject: outsiderId }),
    channelId,
  };
}

test("sendMessage rejects non-members", async () => {
  const t = convexTest(schema, modules);
  const { asOutsider, channelId } = await createServerWithOwnerAndOutsider(t);

  await expect(
    asOutsider.mutation(api.messages.sendMessage, { channelId, content: "hi" }),
  ).rejects.toThrow();
});

test("sendMessage rejects content over 2000 chars", async () => {
  const t = convexTest(schema, modules);
  const { asOwner, channelId } = await createServerWithOwnerAndOutsider(t);

  await expect(
    asOwner.mutation(api.messages.sendMessage, { channelId, content: "a".repeat(2001) }),
  ).rejects.toThrow();

  await asOwner.mutation(api.messages.sendMessage, { channelId, content: "a".repeat(2000) });
});

test("sendMessage and listMessages round-trip with author info", async () => {
  const t = convexTest(schema, modules);
  const { asOwner, channelId } = await createServerWithOwnerAndOutsider(t);

  await asOwner.mutation(api.messages.sendMessage, { channelId, content: "hello" });
  const page = await asOwner.query(api.messages.listMessages, {
    channelId,
    paginationOpts: { numItems: 10, cursor: null },
  });

  expect(page.page).toHaveLength(1);
  expect(page.page[0]?.content).toBe("hello");
  expect(page.page[0]?.authorDisplayName).toBe("Owner");
});
