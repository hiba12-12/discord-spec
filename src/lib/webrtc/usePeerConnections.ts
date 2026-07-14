import { useEffect, useRef, useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { isPolite, IceCandidateBuffer } from "./mesh";
import type { IncomingSignal, SendSignal, ConsumeSignal } from "./signaling";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

interface PeerEntry {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  iceBuffer: IceCandidateBuffer<RTCIceCandidateInit>;
}

export interface PeerConnectionsResult {
  remoteStreams: Map<Id<"users">, MediaStream>;
  connectionStates: Map<Id<"users">, RTCIceConnectionState>;
}

export function usePeerConnections({
  callId,
  myUserId,
  remoteUserIds,
  localStream,
  incomingSignals,
  sendSignal,
  consumeSignal,
}: {
  callId: Id<"calls">;
  myUserId: Id<"users">;
  remoteUserIds: Id<"users">[];
  localStream: MediaStream | null;
  incomingSignals: IncomingSignal[];
  sendSignal: SendSignal;
  consumeSignal: ConsumeSignal;
}): PeerConnectionsResult {
  const peersRef = useRef(new Map<Id<"users">, PeerEntry>());
  const [remoteStreams, setRemoteStreams] = useState(new Map<Id<"users">, MediaStream>());
  const [connectionStates, setConnectionStates] = useState(
    new Map<Id<"users">, RTCIceConnectionState>(),
  );

  function closePeer(userId: Id<"users">) {
    const entry = peersRef.current.get(userId);
    if (!entry) return;
    entry.pc.close();
    peersRef.current.delete(userId);
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
    setConnectionStates((prev) => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  }

  function createPeer(remoteUserId: Id<"users">): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const entry: PeerEntry = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      iceBuffer: new IceCandidateBuffer<RTCIceCandidateInit>(),
    };

    if (localStream) {
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }
    }

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.set(remoteUserId, event.streams[0] ?? new MediaStream([event.track]));
        return next;
      });
    };

    pc.onnegotiationneeded = async () => {
      try {
        entry.makingOffer = true;
        await pc.setLocalDescription();
        await sendSignal({
          callId,
          toUserId: remoteUserId,
          type: "offer",
          payload: JSON.stringify(pc.localDescription),
        });
      } finally {
        entry.makingOffer = false;
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        void sendSignal({
          callId,
          toUserId: remoteUserId,
          type: "ice-candidate",
          payload: JSON.stringify(candidate),
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      setConnectionStates((prev) => {
        const next = new Map(prev);
        next.set(remoteUserId, pc.iceConnectionState);
        return next;
      });
      if (pc.iceConnectionState === "failed") {
        pc.restartIce();
      }
    };

    return entry;
  }

  // Diff the roster: create connections for new participants, close for departed ones. Deliberately
  // does NOT depend on `localStream` — see the effect below for why.
  useEffect(() => {
    const currentIds = new Set(remoteUserIds);
    for (const existingId of peersRef.current.keys()) {
      if (!currentIds.has(existingId)) {
        closePeer(existingId);
      }
    }
    for (const remoteUserId of remoteUserIds) {
      if (!peersRef.current.has(remoteUserId)) {
        peersRef.current.set(remoteUserId, createPeer(remoteUserId));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteUserIds.join(",")]);

  // getUserMedia is async, so `localStream` very commonly flips from null to a real stream
  // *after* the roster-diffing effect above has already created peer connections with no local
  // tracks on them (e.g. this participant's camera/mic was still initializing when the other
  // side joined). That effect only creates connections for *new* participants, so it never goes
  // back and adds tracks to ones that already exist — a participant whose media loaded late would
  // otherwise stay permanently mute/blank to everyone already in the call. This effect fixes that:
  // whenever `localStream` changes, add any of its tracks not yet attached as a sender on each
  // existing peer connection (`addTrack` on a live connection triggers renegotiation on its own).
  useEffect(() => {
    if (!localStream) return;
    for (const entry of peersRef.current.values()) {
      const attachedTracks = new Set(
        entry.pc.getSenders().map((sender) => sender.track).filter((t): t is MediaStreamTrack => t !== null),
      );
      for (const track of localStream.getTracks()) {
        if (!attachedTracks.has(track)) {
          entry.pc.addTrack(track, localStream);
        }
      }
    }
  }, [localStream]);

  useEffect(() => {
    const peers = peersRef.current;
    return () => {
      for (const userId of [...peers.keys()]) {
        closePeer(userId);
      }
    };
  }, []);

  // Apply incoming signals via the perfect-negotiation pattern (research.md §4).
  useEffect(() => {
    for (const signal of incomingSignals) {
      const entry = peersRef.current.get(signal.fromUserId);
      if (!entry) continue;
      void applySignal(entry, signal, myUserId, signal.fromUserId, callId, sendSignal).then(() =>
        consumeSignal({ signalId: signal._id }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSignals]);

  return { remoteStreams, connectionStates };
}

async function applySignal(
  entry: PeerEntry,
  signal: IncomingSignal,
  myUserId: Id<"users">,
  remoteUserId: Id<"users">,
  callId: Id<"calls">,
  sendSignal: SendSignal,
) {
  const { pc } = entry;
  const polite = isPolite(myUserId, remoteUserId);

  if (signal.type === "offer" || signal.type === "answer") {
    const description = JSON.parse(signal.payload) as RTCSessionDescriptionInit;
    const readyForOffer =
      !entry.makingOffer &&
      (pc.signalingState === "stable" || entry.isSettingRemoteAnswerPending);
    const offerCollision = signal.type === "offer" && !readyForOffer;
    entry.ignoreOffer = !polite && offerCollision;
    if (entry.ignoreOffer) return;

    entry.isSettingRemoteAnswerPending = signal.type === "answer";
    await pc.setRemoteDescription(description);
    entry.isSettingRemoteAnswerPending = false;

    for (const candidate of entry.iceBuffer.flush()) {
      await pc.addIceCandidate(candidate);
    }

    if (signal.type === "offer") {
      await pc.setLocalDescription();
      await sendSignal({
        callId,
        toUserId: remoteUserId,
        type: "answer",
        payload: JSON.stringify(pc.localDescription),
      });
    }
  } else {
    const candidate = JSON.parse(signal.payload) as RTCIceCandidateInit;
    const toApply = entry.iceBuffer.addOrBuffer(candidate);
    if (toApply) {
      try {
        await pc.addIceCandidate(toApply);
      } catch (err) {
        if (!entry.ignoreOffer) throw err;
      }
    }
  }
}
