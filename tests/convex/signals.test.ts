import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/*.ts");

async function setupCallWithTwoParticipants(t: ReturnType<typeof convexTest>) {
  const ownerId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: `owner-${Math.random()}@example.com`, displayName: "Owner" }),
  );
  const memberId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: `member-${Math.random()}@example.com`, displayName: "Member" }),
  );
  const outsiderId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: `outsider-${Math.random()}@example.com`,
      displayName: "Outsider",
    }),
  );

  const asOwner = t.withIdentity({ subject: ownerId });
  const asMember = t.withIdentity({ subject: memberId });
  const asOutsider = t.withIdentity({ subject: outsiderId });

  const serverId = await asOwner.mutation(api.servers.createServer, { name: "Test Server" });
  const { server } = await asOwner.query(api.servers.getServer, { serverId });
  await asMember.mutation(api.servers.joinByInvite, { inviteCode: server.inviteCode });
  const channelId = await asOwner.mutation(api.channels.createChannel, {
    serverId,
    name: "voice-room",
    type: "voice",
  });

  const location = { kind: "voiceChannel" as const, channelId };
  const callId = await asOwner.mutation(api.calls.joinCall, { location });
  await asMember.mutation(api.calls.joinCall, { location });

  return { asOwner, asMember, asOutsider, ownerId, memberId, callId };
}

test("sendSignal requires the caller and recipient to both be call participants", async () => {
  const t = convexTest(schema, modules);
  const { asOwner, asOutsider, memberId, callId } = await setupCallWithTwoParticipants(t);

  await expect(
    asOutsider.mutation(api.signals.sendSignal, {
      callId,
      toUserId: memberId,
      type: "offer",
      payload: "{}",
    }),
  ).rejects.toThrow();

  await asOwner.mutation(api.signals.sendSignal, {
    callId,
    toUserId: memberId,
    type: "offer",
    payload: "{}",
  });
});

test("listSignalsForMe only returns signals addressed to the caller", async () => {
  const t = convexTest(schema, modules);
  const { asOwner, asMember, ownerId, memberId, callId } = await setupCallWithTwoParticipants(t);

  await asOwner.mutation(api.signals.sendSignal, {
    callId,
    toUserId: memberId,
    type: "offer",
    payload: "offer-payload",
  });

  const memberSignals = await asMember.query(api.signals.listSignalsForMe, { callId });
  expect(memberSignals).toHaveLength(1);
  expect(memberSignals[0]?.fromUserId).toBe(ownerId);

  const ownerSignals = await asOwner.query(api.signals.listSignalsForMe, { callId });
  expect(ownerSignals).toHaveLength(0);
});

test("consumeSignal only allows the recipient to delete it", async () => {
  const t = convexTest(schema, modules);
  const { asOwner, asMember, memberId, callId } = await setupCallWithTwoParticipants(t);

  await asOwner.mutation(api.signals.sendSignal, {
    callId,
    toUserId: memberId,
    type: "ice-candidate",
    payload: "candidate-payload",
  });
  const [signal] = await asMember.query(api.signals.listSignalsForMe, { callId });

  await expect(
    asOwner.mutation(api.signals.consumeSignal, { signalId: signal!._id }),
  ).rejects.toThrow();

  await asMember.mutation(api.signals.consumeSignal, { signalId: signal!._id });
  const remaining = await asMember.query(api.signals.listSignalsForMe, { callId });
  expect(remaining).toHaveLength(0);
});
