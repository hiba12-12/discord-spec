import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CreateChannelDialog, DeleteChannelDialog, RenameChannelDialog } from "./ChannelDialogs";

type Channel = {
  _id: Id<"channels">;
  name: string;
  type: "text" | "voice";
};

interface Member {
  userId: Id<"users">;
  displayName: string;
}

export function ChannelSidebar({
  serverId,
  activeChannelId,
  isOwner,
  members,
}: {
  serverId: Id<"servers">;
  activeChannelId?: Id<"channels">;
  isOwner: boolean;
  members: Member[];
}) {
  const channels = useQuery(api.channels.listChannels, { serverId });
  const activeCalls = useQuery(api.calls.listActiveCallsForServer, { serverId });
  const createChannel = useMutation(api.channels.createChannel);
  const renameChannel = useMutation(api.channels.renameChannel);
  const deleteChannel = useMutation(api.channels.deleteChannel);
  const displayNameById = new Map(members.map((m) => [m.userId, m.displayName]));

  const [showCreate, setShowCreate] = useState(false);
  const [channelToRename, setChannelToRename] = useState<Channel | null>(null);
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);

  return (
    <div className="flex w-60 shrink-0 flex-col bg-discord-bg-secondary p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-discord-text-muted">Channels</h3>
        {isOwner && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            title="Create channel"
            className="text-lg leading-none text-discord-text-muted hover:text-discord-text-normal"
          >
            +
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-0.5">
        {channels?.map((channel) => (
          <li
            key={channel._id}
            className={`group flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-discord-bg-primary hover:text-discord-text-normal ${
              channel._id === activeChannelId
                ? "bg-discord-bg-primary text-discord-text-normal"
                : "text-discord-text-muted"
            }`}
          >
            <Link
              to={`/servers/${serverId}/${channel._id}`}
              className="flex min-w-0 flex-1 flex-col gap-0.5 truncate py-0.5"
            >
              <span className="flex items-center gap-1.5">
                <span>{channel.type === "voice" ? "🔊" : "#"}</span>
                {channel.name}
              </span>
              {channel.type === "voice" && (activeCalls?.[channel._id]?.length ?? 0) > 0 && (
                <span className="pl-5 text-xs text-discord-text-muted">
                  {activeCalls![channel._id]!.map((userId) => displayNameById.get(userId) ?? "Unknown").join(", ")}
                </span>
              )}
            </Link>
            {isOwner && (
              <span className="hidden shrink-0 gap-1 group-hover:flex">
                <button
                  type="button"
                  onClick={() => setChannelToRename(channel)}
                  title="Rename channel"
                  className="hover:text-discord-text-normal"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() => setChannelToDelete(channel)}
                  title="Delete channel"
                  className="hover:text-discord-danger"
                >
                  🗑️
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {showCreate && (
        <CreateChannelDialog
          onCreate={async (name, type) => {
            await createChannel({ serverId, name, type });
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
      {channelToRename && (
        <RenameChannelDialog
          currentName={channelToRename.name}
          onRename={async (name) => {
            await renameChannel({ channelId: channelToRename._id, name });
          }}
          onClose={() => setChannelToRename(null)}
        />
      )}
      {channelToDelete && (
        <DeleteChannelDialog
          channelName={channelToDelete.name}
          onConfirm={async () => {
            await deleteChannel({ channelId: channelToDelete._id });
          }}
          onClose={() => setChannelToDelete(null)}
        />
      )}
    </div>
  );
}
