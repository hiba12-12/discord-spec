import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { MessageScope } from "../../lib/messageScope";

export function TypingIndicator({ scope }: { scope: MessageScope }) {
  const typingUsers = useQuery(api.typingIndicators.listTypingUsers, { scope });

  if (!typingUsers || typingUsers.length === 0) {
    return <div className="h-5 px-4 text-xs text-discord-text-muted" />;
  }

  const names = typingUsers.map((u) => u.displayName);
  const text =
    names.length === 1
      ? `${names[0]} is typing...`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing...`
        : `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]} are typing...`;

  return <div className="h-5 px-4 text-xs italic text-discord-text-muted">{text}</div>;
}
