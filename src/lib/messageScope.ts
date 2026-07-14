import type { Id } from "../../convex/_generated/dataModel";

export type MessageScope =
  | { kind: "channel"; channelId: Id<"channels"> }
  | { kind: "thread"; threadId: Id<"directMessageThreads"> };
