import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CallView } from "./CallView";

export function VoiceChannelView({ channelId }: { channelId: Id<"channels"> }) {
  const joinCall = useMutation(api.calls.joinCall);
  const [callId, setCallId] = useState<Id<"calls"> | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setJoining(true);
    setError(null);
    try {
      const id = await joinCall({ location: { kind: "voiceChannel", channelId } });
      setCallId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the call");
    } finally {
      setJoining(false);
    }
  }

  if (callId) {
    return <CallView callId={callId} onLeave={() => setCallId(null)} />;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-discord-bg-primary text-discord-text-muted">
      {error && <p className="text-discord-danger">{error}</p>}
      <button
        type="button"
        onClick={handleJoin}
        disabled={joining}
        className="rounded-full bg-discord-brand px-5 py-2 font-medium text-white hover:bg-discord-brand-hover disabled:opacity-50"
      >
        {joining ? "Joining..." : "Join Call"}
      </button>
    </div>
  );
}
