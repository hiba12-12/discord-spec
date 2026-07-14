import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/*.ts");

test("joinByInvite accepts a valid inviteCode and adds the caller as a member", async () => {
  const t = convexTest(schema, modules);

  const ownerId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "owner@example.com", displayName: "Owner" }),
  );
  const joinerId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "joiner@example.com", displayName: "Joiner" }),
  );

  const asOwner = t.withIdentity({ subject: ownerId });
  const serverId = await asOwner.mutation(api.servers.createServer, { name: "Test Server" });
  const { server } = await asOwner.query(api.servers.getServer, { serverId });

  const asJoiner = t.withIdentity({ subject: joinerId });
  const joinedServerId = await asJoiner.mutation(api.servers.joinByInvite, {
    inviteCode: server.inviteCode,
  });

  expect(joinedServerId).toBe(serverId);
  const { members } = await asJoiner.query(api.servers.getServer, { serverId });
  expect(members.map((m) => m.userId)).toContain(joinerId);
});

test("joinByInvite rejects an invalid inviteCode", async () => {
  const t = convexTest(schema, modules);

  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "user@example.com", displayName: "User" }),
  );

  await expect(
    t.withIdentity({ subject: userId }).mutation(api.servers.joinByInvite, {
      inviteCode: "does-not-exist",
    }),
  ).rejects.toThrow();
});

test("joinByInvite rejects a stale inviteCode after regeneration", async () => {
  const t = convexTest(schema, modules);

  const ownerId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "owner2@example.com", displayName: "Owner" }),
  );
  const joinerId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "joiner2@example.com", displayName: "Joiner" }),
  );

  const asOwner = t.withIdentity({ subject: ownerId });
  const serverId = await asOwner.mutation(api.servers.createServer, { name: "Test Server" });
  const { server: staleServer } = await asOwner.query(api.servers.getServer, { serverId });
  const staleCode = staleServer.inviteCode;

  await asOwner.mutation(api.servers.regenerateInvite, { serverId });

  await expect(
    t.withIdentity({ subject: joinerId }).mutation(api.servers.joinByInvite, {
      inviteCode: staleCode,
    }),
  ).rejects.toThrow();
});

test("regenerateInvite is owner-only", async () => {
  const t = convexTest(schema, modules);

  const ownerId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "owner3@example.com", displayName: "Owner" }),
  );
  const outsiderId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "outsider3@example.com", displayName: "Outsider" }),
  );

  const asOwner = t.withIdentity({ subject: ownerId });
  const serverId = await asOwner.mutation(api.servers.createServer, { name: "Test Server" });

  await expect(
    t.withIdentity({ subject: outsiderId }).mutation(api.servers.regenerateInvite, { serverId }),
  ).rejects.toThrow();
});
