import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/*.ts");

test("removeMember is owner-only", async () => {
  const t = convexTest(schema, modules);

  const ownerId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "owner@example.com", displayName: "Owner" }),
  );
  const memberId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "member@example.com", displayName: "Member" }),
  );
  const outsiderId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "outsider@example.com", displayName: "Outsider" }),
  );

  const asOwner = t.withIdentity({ subject: ownerId });
  const serverId = await asOwner.mutation(api.servers.createServer, { name: "Test Server" });
  const { server } = await asOwner.query(api.servers.getServer, { serverId });
  await t.withIdentity({ subject: memberId }).mutation(api.servers.joinByInvite, {
    inviteCode: server.inviteCode,
  });

  await expect(
    t.withIdentity({ subject: outsiderId }).mutation(api.servers.removeMember, {
      serverId,
      userId: memberId,
    }),
  ).rejects.toThrow();

  await asOwner.mutation(api.servers.removeMember, { serverId, userId: memberId });
  const { members } = await asOwner.query(api.servers.getServer, { serverId });
  expect(members.map((m) => m.userId)).not.toContain(memberId);
});

test("removeMember rejects targeting the owner themself", async () => {
  const t = convexTest(schema, modules);

  const ownerId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "owner2@example.com", displayName: "Owner" }),
  );

  const asOwner = t.withIdentity({ subject: ownerId });
  const serverId = await asOwner.mutation(api.servers.createServer, { name: "Test Server" });

  await expect(
    asOwner.mutation(api.servers.removeMember, { serverId, userId: ownerId }),
  ).rejects.toThrow();
});
