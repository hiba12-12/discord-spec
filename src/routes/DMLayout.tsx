import { Routes, Route, useParams } from "react-router-dom";
import type { Id } from "../../convex/_generated/dataModel";
import { DMList } from "../features/directMessages/DMList";
import { DMChatPane } from "../features/directMessages/DMChatPane";

function DMHome() {
  return (
    <div className="flex flex-1 items-center justify-center bg-discord-bg-primary text-discord-text-muted">
      Select a conversation
    </div>
  );
}

function DMThread() {
  const { threadId } = useParams<{ threadId: Id<"directMessageThreads"> }>();
  if (!threadId) return null;
  return <DMChatPane threadId={threadId as Id<"directMessageThreads">} />;
}

export default function DMLayout() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <DMList />
      <Routes>
        <Route index element={<DMHome />} />
        <Route path=":threadId" element={<DMThread />} />
      </Routes>
    </div>
  );
}
