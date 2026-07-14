import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ChatPane } from "../messages/ChatPane";
import { CallView } from "../calls/CallView";

export function DMChatPane({ threadId }: { threadId: Id<"directMessageThreads"> }) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const threads = useQuery(api.directMessageThreads.listMyThreads);
  const thread = threads?.find((t) => t._id === threadId);
  const activeCall = useQuery(api.calls.getActiveCallForDmThread, { threadId });
  const joinCall = useMutation(api.calls.joinCall);
  const [joinedCallId, setJoinedCallId] = useState<Id<"calls"> | null>(null);
  const [joining, setJoining] = useState(false);

  async function handleJoinCall() {
    setJoining(true);
    try {
      const id = await joinCall({ location: { kind: "dm", threadId } });
      setJoinedCallId(id);
    } finally {
      setJoining(false);
    }
  }

  // Reflects a page refresh mid-call, or a call that's still active from before this
  // component mounted — either way, if the reactive query shows us as a participant, drop
  // straight into the call view instead of re-showing the join button.
  const iAmAlreadyInCall =
    currentUser && activeCall?.participantUserIds.includes(currentUser._id);
  const effectiveCallId = joinedCallId ?? (iAmAlreadyInCall ? activeCall!.callId : null);

  if (effectiveCallId) {
    return <CallView callId={effectiveCallId} onLeave={() => setJoinedCallId(null)} />;
  }

  const incomingCall = activeCall !== null && activeCall !== undefined;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-discord-bg-tertiary p-3">
        <h2 className="truncate font-semibold text-discord-text-normal">
          {thread?.otherUserDisplayName ?? "..."}
        </h2>
        <button
          type="button"
          onClick={handleJoinCall}
          disabled={joining}
          title={incomingCall ? "Join video call" : "Start video call"}
          className={`rounded px-3 py-1 text-sm font-medium text-white disabled:opacity-50 ${
            incomingCall
              ? "animate-pulse bg-discord-online hover:opacity-90"
              : "bg-discord-brand hover:bg-discord-brand-hover"
          }`}
        >
          {incomingCall
            ? `📹 ${thread?.otherUserDisplayName ?? "Someone"} is calling — Join`
            : "📹 Call"}
        </button>
      </div>
      <ChatPane scope={{ kind: "thread", threadId }} />
    </div>
  );
}
