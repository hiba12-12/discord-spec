import type { Id } from "../../../convex/_generated/dataModel";

export type SignalType = "offer" | "answer" | "ice-candidate";

export interface IncomingSignal {
  _id: Id<"signals">;
  fromUserId: Id<"users">;
  type: SignalType;
  payload: string;
}

export type SendSignal = (args: {
  callId: Id<"calls">;
  toUserId: Id<"users">;
  type: SignalType;
  payload: string;
}) => Promise<unknown>;

export type ConsumeSignal = (args: { signalId: Id<"signals"> }) => Promise<unknown>;
