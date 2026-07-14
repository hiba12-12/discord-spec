import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/*.ts");

test("setStatus updates the caller's own visibility and is reflected to other members", async () => {
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

  const before = await asOwner.query(api.servers.getServer, { serverId });
  expect(before.members.find((m) => m.userId === memberId)?.status).toBe("online");

  await asMember.mutation(api.users.setStatus, { status: "invisible" });

  const after = await asOwner.query(api.servers.getServer, { serverId });
  expect(after.members.find((m) => m.userId === memberId)?.status).toBe("invisible");

  await asMember.mutation(api.users.setStatus, { status: "online" });
  const restored = await asOwner.query(api.servers.getServer, { serverId });
  expect(restored.members.find((m) => m.userId === memberId)?.status).toBe("online");
});

test("setStatus requires authentication", async () => {
  const t = convexTest(schema, modules);
  await expect(t.mutation(api.users.setStatus, { status: "invisible" })).rejects.toThrow();
});
