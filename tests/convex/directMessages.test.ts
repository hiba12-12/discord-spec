import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/*.ts");

async function setupSharedThread(t: ReturnType<typeof convexTest>) {
  const aliceId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: `alice-${Math.random()}@example.com`, displayName: "Alice" }),
  );
  const bobId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: `bob-${Math.random()}@example.com`, displayName: "Bob" }),
  );
  const outsiderId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: `outsider-${Math.random()}@example.com`,
      displayName: "Outsider",
    }),
  );

  const asAlice = t.withIdentity({ subject: aliceId });
  const asBob = t.withIdentity({ subject: bobId });
  const asOutsider = t.withIdentity({ subject: outsiderId });

  const serverId = await asAlice.mutation(api.servers.createServer, { name: "Shared Server" });
  const { server } = await asAlice.query(api.servers.getServer, { serverId });
  await asBob.mutation(api.servers.joinByInvite, { inviteCode: server.inviteCode });

  const threadId = await asAlice.mutation(api.directMessageThreads.openThread, {
    otherUserId: bobId,
  });

  return { asAlice, asBob, asOutsider, threadId };
}

test("sendDirectMessage requires thread participation", async () => {
  const t = convexTest(schema, modules);
  const { asBob, asOutsider, threadId } = await setupSharedThread(t);

  await expect(
    asOutsider.mutation(api.directMessages.sendDirectMessage, { threadId, content: "hi" }),
  ).rejects.toThrow();

  await asBob.mutation(api.directMessages.sendDirectMessage, { threadId, content: "hi Alice" });
  const page = await asBob.query(api.directMessages.listDirectMessages, {
    threadId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(page.page).toHaveLength(1);
  expect(page.page[0]?.content).toBe("hi Alice");
});

test("editDirectMessage/deleteDirectMessage are author-only", async () => {
  const t = convexTest(schema, modules);
  const { asAlice, asBob, threadId } = await setupSharedThread(t);

  const messageId = await asAlice.mutation(api.directMessages.sendDirectMessage, {
    threadId,
    content: "original",
  });

  await expect(
    asBob.mutation(api.directMessages.editDirectMessage, { messageId, content: "hacked" }),
  ).rejects.toThrow();
  await expect(
    asBob.mutation(api.directMessages.deleteDirectMessage, { messageId }),
  ).rejects.toThrow();

  await asAlice.mutation(api.directMessages.editDirectMessage, { messageId, content: "edited" });
  await asAlice.mutation(api.directMessages.deleteDirectMessage, { messageId });

  const page = await asAlice.query(api.directMessages.listDirectMessages, {
    threadId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(page.page).toHaveLength(0);
});
