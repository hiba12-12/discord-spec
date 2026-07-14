import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { usePeerConnections } from "../../lib/webrtc/usePeerConnections";

const HEARTBEAT_INTERVAL_MS = 5_000;

function VideoTile({
  stream,
  displayName,
  micOn,
  cameraOn,
  isSpeaking,
  isLocal,
  connectionState,
}: {
  stream: MediaStream | null;
  displayName: string;
  micOn: boolean;
  cameraOn: boolean;
  isSpeaking: boolean;
  isLocal: boolean;
  connectionState?: RTCIceConnectionState;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const showVideo = cameraOn && stream !== null;

  // The <video> element stays mounted at all times (rather than being conditionally rendered)
  // so this effect only needs to run when the stream itself changes — a conditionally-mounted
  // <video> would get a fresh DOM node on every camera on/off toggle, and this effect (keyed on
  // `stream`, which doesn't change on a toggle) would never re-attach srcObject to it.
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  const connectionFailed = connectionState === "failed";

  return (
    <div
      className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-discord-bg-tertiary ${
        isSpeaking ? "ring-2 ring-discord-online" : ""
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`h-full w-full object-cover ${showVideo ? "" : "hidden"}`}
      />
      {!showVideo && (
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-discord-brand text-2xl font-semibold text-white">
          {displayName.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
        {!micOn && <span title="Muted">🔇</span>}
        <span>{displayName}</span>
      </div>
      {connectionFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-discord-danger">
          Couldn't connect
        </div>
      )}
    </div>
  );
}

export function CallView({
  callId,
  onLeave,
}: {
  callId: Id<"calls">;
  onLeave: () => void;
}) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const participants = useQuery(api.calls.listParticipants, { callId });
  const incomingSignals = useQuery(api.signals.listSignalsForMe, { callId }) ?? [];
  const leaveCall = useMutation(api.calls.leaveCall);
  const updateParticipantState = useMutation(api.calls.updateParticipantState);
  const callHeartbeat = useMutation(api.calls.callHeartbeat);
  const sendSignal = useMutation(api.signals.sendSignal);
  const consumeSignal = useMutation(api.signals.consumeSignal);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mediaWarning, setMediaWarning] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    // Camera/mic access can fail for reasons that shouldn't block joining the call at all: no
    // permission, no device, or — very commonly when testing two participants on one machine —
    // the webcam (and its bundled mic, on most laptops) already being held exclusively by
    // another tab. Degrade in stages instead of giving up: video+audio, then audio-only, then no
    // local media at all. Even with nothing to send, the participant can still see/hear everyone
    // else, since receiving remote tracks doesn't require a local stream.
    async function acquireMedia(): Promise<MediaStream | null> {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch {
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (!cancelled) {
            setMediaWarning(
              "Camera unavailable (no permission, or it's in use elsewhere) — joined with audio only.",
            );
          }
          return audioOnly;
        } catch {
          if (!cancelled) {
            setMediaWarning(
              "Couldn't access your camera or microphone (often because another tab is already " +
                "using them) — you can still see and hear everyone else, but they won't see or " +
                "hear you.",
            );
          }
          return null;
        }
      }
    }

    acquireMedia().then((s) => {
      if (cancelled) {
        s?.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = s;
      s?.getVideoTracks().forEach((t) => (t.enabled = false));
      setLocalStream(s);
    });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      void callHeartbeat({ callId });
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [callId, callHeartbeat]);

  // Reflect a missing mic to other participants (default participant state assumes mic on) —
  // otherwise they'd see a "not muted" indicator for someone who can't actually send audio.
  useEffect(() => {
    if (localStream !== null && localStream.getAudioTracks().length === 0) {
      setMicOn(false);
      void updateParticipantState({ callId, micOn: false });
    }
  }, [localStream, callId, updateParticipantState]);

  const remoteUserIds = (participants ?? [])
    .map((p) => p.userId)
    .filter((id) => id !== currentUser?._id);

  const { remoteStreams, connectionStates } = usePeerConnections({
    callId,
    myUserId: currentUser?._id ?? ("" as Id<"users">),
    remoteUserIds,
    localStream,
    incomingSignals,
    sendSignal,
    consumeSignal,
  });

  const hasAudioTrack = (localStream?.getAudioTracks().length ?? 0) > 0;
  const hasVideoTrack = (localStream?.getVideoTracks().length ?? 0) > 0;

  async function toggleMic() {
    if (!hasAudioTrack) return;
    const next = !micOn;
    localStream?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
    await updateParticipantState({ callId, micOn: next });
  }

  async function toggleCamera() {
    if (!hasVideoTrack) return;
    const next = !cameraOn;
    localStream?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCameraOn(next);
    await updateParticipantState({ callId, cameraOn: next });
  }

  async function handleLeave() {
    await leaveCall({ callId });
    onLeave();
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-discord-bg-primary p-4">
      {mediaWarning && (
        <p className="mb-2 text-center text-xs text-discord-text-muted">{mediaWarning}</p>
      )}
      <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-3 overflow-y-auto">
        {currentUser && (
          <VideoTile
            stream={localStream}
            displayName={`${currentUser.displayName ?? "You"} (you)`}
            micOn={micOn}
            cameraOn={cameraOn}
            isSpeaking={false}
            isLocal
          />
        )}
        {(participants ?? [])
          .filter((p) => p.userId !== currentUser?._id)
          .map((p) => (
            <VideoTile
              key={p.userId}
              stream={remoteStreams.get(p.userId) ?? null}
              displayName={p.displayName}
              micOn={p.micOn}
              cameraOn={p.cameraOn}
              isSpeaking={p.isSpeaking}
              isLocal={false}
              connectionState={connectionStates.get(p.userId)}
            />
          ))}
      </div>
      <div className="mt-4 flex justify-center gap-3">
        <button
          type="button"
          onClick={toggleMic}
          disabled={!hasAudioTrack}
          title={hasAudioTrack ? undefined : "No microphone available"}
          className="rounded-full bg-discord-bg-tertiary px-4 py-2 text-sm text-discord-text-normal hover:bg-discord-bg-secondary disabled:opacity-50"
        >
          {micOn ? "Mute" : "Unmute"}
        </button>
        <button
          type="button"
          onClick={toggleCamera}
          disabled={!hasVideoTrack}
          title={hasVideoTrack ? undefined : "No camera available"}
          className="rounded-full bg-discord-bg-tertiary px-4 py-2 text-sm text-discord-text-normal hover:bg-discord-bg-secondary disabled:opacity-50"
        >
          {cameraOn ? "Stop Video" : "Start Video"}
        </button>
        <button
          type="button"
          onClick={handleLeave}
          className="rounded-full bg-discord-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Leave
        </button>
      </div>
    </div>
  );
}
