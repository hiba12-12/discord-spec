import { Routes, Route, useParams, Navigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { CreateServerForm } from "../features/servers/CreateServerForm";
import { JoinServerForm } from "../features/servers/JoinServerForm";
import { MemberList } from "../features/servers/MemberList";
import { ServerSettings } from "../features/servers/ServerSettings";
import { ChannelSidebar } from "../features/channels/ChannelSidebar";
import { ChatPane } from "../features/messages/ChatPane";
import { VoiceChannelView } from "../features/calls/VoiceChannelView";

function ServerHome() {
  return (
    <div className="flex flex-1 items-center justify-center bg-discord-bg-primary">
      <div className="flex w-full max-w-sm flex-col divide-y divide-discord-bg-tertiary rounded-md bg-discord-bg-secondary">
        <CreateServerForm />
        <JoinServerForm />
      </div>
    </div>
  );
}

function ServerRoot() {
  const { serverId } = useParams<{ serverId: Id<"servers"> }>();
  const channels = useQuery(
    api.channels.listChannels,
    serverId ? { serverId: serverId as Id<"servers"> } : "skip",
  );

  if (!serverId) return null;
  if (channels === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center bg-discord-bg-primary text-discord-text-muted">
        Loading server...
      </div>
    );
  }
  if (channels.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-discord-bg-primary text-discord-text-muted">
        This server has no channels yet.
      </div>
    );
  }

  const defaultChannel =
    channels.find((c) => c.name === "general") ?? channels.find((c) => c.type === "text") ?? channels[0]!;
  return <Navigate to={`/servers/${serverId}/${defaultChannel._id}`} replace />;
}

function ServerView() {
  const { serverId, channelId } = useParams<{
    serverId: Id<"servers">;
    channelId: Id<"channels">;
  }>();
  const data = useQuery(
    api.servers.getServer,
    serverId ? { serverId: serverId as Id<"servers"> } : "skip",
  );
  const channels = useQuery(
    api.channels.listChannels,
    serverId ? { serverId: serverId as Id<"servers"> } : "skip",
  );
  const currentUser = useQuery(api.users.getCurrentUser);

  if (!serverId || !channelId) return null;
  if (data === undefined || channels === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center bg-discord-bg-primary text-discord-text-muted">
        Loading server...
      </div>
    );
  }

  const isOwner = currentUser?._id === data.server.ownerId;
  const activeChannel = channels.find((c) => c._id === channelId);

  return (
    <div className="flex flex-1 overflow-hidden">
      <ChannelSidebar
        serverId={serverId as Id<"servers">}
        activeChannelId={channelId as Id<"channels">}
        isOwner={isOwner}
        members={data.members}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <ServerSettings
          serverId={serverId as Id<"servers">}
          serverName={data.server.name}
          inviteCode={data.server.inviteCode}
          isOwner={isOwner}
        />
        {activeChannel?.type === "voice" ? (
          <VoiceChannelView channelId={channelId as Id<"channels">} />
        ) : (
          <ChatPane
            scope={{ kind: "channel", channelId: channelId as Id<"channels"> }}
            channelName={activeChannel?.name}
          />
        )}
      </div>
      <MemberList
        serverId={serverId as Id<"servers">}
        members={data.members}
        ownerId={data.server.ownerId}
      />
    </div>
  );
}

export default function ServerLayout() {
  return (
    <Routes>
      <Route index element={<ServerHome />} />
      <Route path=":serverId" element={<ServerRoot />} />
      <Route path=":serverId/:channelId" element={<ServerView />} />
    </Routes>
  );
}
