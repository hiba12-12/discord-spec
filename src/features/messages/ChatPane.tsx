import type { MessageScope } from "../../lib/messageScope";
import { MessageList } from "./MessageList";
import { TypingIndicator } from "./TypingIndicator";
import { Composer } from "./Composer";

export function ChatPane({ scope }: { scope: MessageScope }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-discord-bg-primary">
      <MessageList scope={scope} />
      <TypingIndicator scope={scope} />
      <Composer scope={scope} />
    </div>
  );
}
