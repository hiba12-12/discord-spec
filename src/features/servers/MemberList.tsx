import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import usePresence from "@convex-dev/presence/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface Member {
  userId: Id<"users">;
  displayName: string;
  avatarUrl?: string;
  status: "online" | "invisible";
}

export function MemberList({
  serverId,
  members,
  ownerId,
}: {
  serverId: Id<"servers">;
  members: Member[];
  ownerId: Id<"users">;
}) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const removeMember = useMutation(api.servers.removeMember);
  const openThread = useMutation(api.directMessageThreads.openThread);
  const navigate = useNavigate();
  const [removingUserId, setRemovingUserId] = useState<Id<"users"> | null>(null);
  // usePresence drives a heartbeat + reactive online-state list scoped to this server's "room"
  // (research.md §2 — @convex-dev/presence, not a hand-rolled heartbeat table). A short 3s
  // interval (vs. the 10s default) keeps the offline-detection fallback fast — a user is
  // considered offline after 2.5x the interval with no heartbeat (~7.5s here) even in
  // environments where the disconnect-on-unload beacon doesn't fire.
  const presenceState = usePresence(
    api.presence,
    serverId,
    currentUser ? currentUser._id : "anonymous",
    3000,
  );
  const connectedUserIds = new Set(
    (presenceState ?? []).filter((p) => p.online).map((p) => p.userId),
  );
  const statusByUserId = new Map(members.map((m) => [m.userId, m.status]));
  function isShownOnline(userId: Id<"users">) {
    return connectedUserIds.has(userId) && statusByUserId.get(userId) !== "invisible";
  }
  const isOwner = currentUser?._id === ownerId;

  async function handleRemove(userId: Id<"users">) {
    setRemovingUserId(userId);
    try {
      await removeMember({ serverId, userId });
    } finally {
      setRemovingUserId(null);
    }
  }

  async function handleMessage(userId: Id<"users">) {
    const threadId = await openThread({ otherUserId: userId });
    navigate(`/dms/${threadId}`);
  }

  return (
    <div className="w-60 shrink-0 overflow-y-auto bg-discord-bg-secondary p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase text-discord-text-muted">
        Members — {members.length}
      </h3>
      <ul className="flex flex-col gap-1">
        {members.map((member) => (
          <li
            key={member.userId}
            className="group flex items-center justify-between rounded px-2 py-1 hover:bg-discord-bg-primary"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-discord-brand text-xs font-semibold text-white">
                {member.displayName.slice(0, 1).toUpperCase()}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-discord-bg-secondary ${
                    isShownOnline(member.userId) ? "bg-discord-online" : "bg-discord-offline"
                  }`}
                />
              </span>
              <span className="truncate text-sm text-discord-text-normal">
                {member.displayName}
                {member.userId === ownerId && (
                  <span className="ml-1 text-xs text-discord-text-muted">(owner)</span>
                )}
              </span>
            </span>
            {member.userId !== currentUser?._id && (
              <span className="hidden shrink-0 items-center gap-2 text-xs text-discord-text-muted group-hover:flex">
                <button
                  type="button"
                  onClick={() => handleMessage(member.userId)}
                  title="Message"
                  className="hover:text-discord-text-normal"
                >
                  Message
                </button>
                {isOwner && member.userId !== ownerId && (
                  <button
                    type="button"
                    onClick={() => handleRemove(member.userId)}
                    disabled={removingUserId === member.userId}
                    title="Remove member"
                    className="hover:text-discord-danger disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
