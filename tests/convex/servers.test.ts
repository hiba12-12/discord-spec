import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

// NOTE: `t.withIdentity({ subject: userId })` here simulates an authenticated Convex Auth
// session for `getAuthUserId` to resolve. If @convex-dev/auth's actual test-identity subject
// format differs once this is run for real (verify against convex-test + @convex-dev/auth's own
// docs at implementation time), adjust the identity shape below accordingly — this was written
// against the documented convex-test pattern, not verified against a live @convex-dev/auth
// integration test.
const modules = import.meta.glob("../../convex/**/*.ts");

test("createServer creates a server, owner membership, and default general channel", async () => {
  const t = convexTest(schema, modules);

  const userId = await t.run(async (ctx) => {
    return ctx.db.insert("users", {
      email: "owner@example.com",
      displayName: "Owner",
    });
  });

  const asOwner = t.withIdentity({ subject: userId });

  const serverId = await asOwner.mutation(api.servers.createServer, {
    name: "Test Server",
  });

  const { server, members } = await asOwner.query(api.servers.getServer, { serverId });

  expect(server.name).toBe("Test Server");
  expect(server.ownerId).toBe(userId);
  expect(members).toHaveLength(1);
  expect(members[0]?.userId).toBe(userId);

  const channels = await asOwner.query(api.channels.listChannels, { serverId });
  expect(channels).toHaveLength(1);
  expect(channels[0]?.name).toBe("general");
  expect(channels[0]?.type).toBe("text");
});

test("getServer rejects a non-member", async () => {
  const t = convexTest(schema, modules);

  const ownerId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "owner2@example.com", displayName: "Owner" }),
  );
  const outsiderId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "outsider@example.com", displayName: "Outsider" }),
  );

  const serverId = await t
    .withIdentity({ subject: ownerId })
    .mutation(api.servers.createServer, { name: "Private Server" });

  await expect(
    t.withIdentity({ subject: outsiderId }).query(api.servers.getServer, { serverId }),
  ).rejects.toThrow();
});
