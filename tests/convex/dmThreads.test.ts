import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/*.ts");

test("openThread requires a shared server and find-or-creates on the canonical pair", async () => {
  const t = convexTest(schema, modules);

  const aliceId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "alice@example.com", displayName: "Alice" }),
  );
  const bobId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "bob@example.com", displayName: "Bob" }),
  );

  const asAlice = t.withIdentity({ subject: aliceId });
  const serverId = await asAlice.mutation(api.servers.createServer, { name: "Shared Server" });
  const { server } = await asAlice.query(api.servers.getServer, { serverId });
  await t.withIdentity({ subject: bobId }).mutation(api.servers.joinByInvite, {
    inviteCode: server.inviteCode,
  });

  const threadId1 = await asAlice.mutation(api.directMessageThreads.openThread, {
    otherUserId: bobId,
  });
  const threadId2 = await t
    .withIdentity({ subject: bobId })
    .mutation(api.directMessageThreads.openThread, { otherUserId: aliceId });

  expect(threadId2).toBe(threadId1);

  const aliceThreads = await asAlice.query(api.directMessageThreads.listMyThreads, {});
  expect(aliceThreads).toHaveLength(1);
  expect(aliceThreads[0]?.otherUserId).toBe(bobId);
});

test("openThread rejects users who share no server", async () => {
  const t = convexTest(schema, modules);

  const aliceId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "alice2@example.com", displayName: "Alice" }),
  );
  const carolId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "carol2@example.com", displayName: "Carol" }),
  );

  await expect(
    t.withIdentity({ subject: aliceId }).mutation(api.directMessageThreads.openThread, {
      otherUserId: carolId,
    }),
  ).rejects.toThrow();
});
