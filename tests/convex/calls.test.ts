import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/*.ts");

async function setupVoiceChannelWithMembers(t: ReturnType<typeof convexTest>, memberCount: number) {
  const ownerId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: `owner-${Math.random()}@example.com`, displayName: "Owner" }),
  );
  const asOwner = t.withIdentity({ subject: ownerId });
  const serverId = await asOwner.mutation(api.servers.createServer, { name: "Test Server" });
  const { server } = await asOwner.query(api.servers.getServer, { serverId });
  const channelId = await asOwner.mutation(api.channels.createChannel, {
    serverId,
    name: "voice-room",
    type: "voice",
  });

  const memberIdentities = [asOwner];
  for (let i = 1; i < memberCount; i++) {
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: `member${i}-${Math.random()}@example.com`,
        displayName: `Member${i}`,
      }),
    );
    const asMember = t.withIdentity({ subject: userId });
    await asMember.mutation(api.servers.joinByInvite, { inviteCode: server.inviteCode });
    memberIdentities.push(asMember);
  }

  return { channelId, memberIdentities };
}

test("joinCall rejects a 5th participant with a clear error", async () => {
  const t = convexTest(schema, modules);
  const { channelId, memberIdentities } = await setupVoiceChannelWithMembers(t, 5);

  const location = { kind: "voiceChannel" as const, channelId };
  let callId;
  for (let i = 0; i < 4; i++) {
    callId = await memberIdentities[i]!.mutation(api.calls.joinCall, { location });
  }

  await expect(
    memberIdentities[4]!.mutation(api.calls.joinCall, { location }),
  ).rejects.toThrow(/full/i);

  const participants = await memberIdentities[0]!.query(api.calls.listParticipants, {
    callId: callId!,
  });
  expect(participants).toHaveLength(4);
});

test("leaveCall ends the call when the last participant leaves", async () => {
  const t = convexTest(schema, modules);
  const { channelId, memberIdentities } = await setupVoiceChannelWithMembers(t, 2);
  const location = { kind: "voiceChannel" as const, channelId };

  const callId = await memberIdentities[0]!.mutation(api.calls.joinCall, { location });
  await memberIdentities[1]!.mutation(api.calls.joinCall, { location });

  await memberIdentities[0]!.mutation(api.calls.leaveCall, { callId });
  const remaining = await memberIdentities[1]!.query(api.calls.listParticipants, { callId });
  expect(remaining).toHaveLength(1);

  await memberIdentities[1]!.mutation(api.calls.leaveCall, { callId });

  const call = await t.run(async (ctx) => ctx.db.get(callId));
  expect(call).toBeNull();
});

test("joinCall is idempotent for an already-joined participant", async () => {
  const t = convexTest(schema, modules);
  const { channelId, memberIdentities } = await setupVoiceChannelWithMembers(t, 1);
  const location = { kind: "voiceChannel" as const, channelId };

  const callId1 = await memberIdentities[0]!.mutation(api.calls.joinCall, { location });
  const callId2 = await memberIdentities[0]!.mutation(api.calls.joinCall, { location });
  expect(callId2).toBe(callId1);

  const participants = await memberIdentities[0]!.query(api.calls.listParticipants, {
    callId: callId1,
  });
  expect(participants).toHaveLength(1);
});
