import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "sweep stale typing indicators",
  { seconds: 10 },
  internal.typingIndicators.sweepStaleTyping,
);

crons.interval(
  "sweep stale call participants",
  { seconds: 10 },
  internal.calls.sweepStaleCallParticipants,
);

export default crons;
