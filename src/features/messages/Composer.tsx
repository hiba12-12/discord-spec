import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { MessageScope } from "../../lib/messageScope";

const TYPING_THROTTLE_MS = 2_000;
const STOP_TYPING_DELAY_MS = 3_000;

export function Composer({ scope }: { scope: MessageScope }) {
  const sendMessage = useMutation(api.messages.sendMessage);
  const sendDirectMessage = useMutation(api.directMessages.sendDirectMessage);
  const setTyping = useMutation(api.typingIndicators.setTyping);
  const clearTyping = useMutation(api.typingIndicators.clearTyping);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const lastTypingCallAt = useRef(0);
  const stopTypingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleKeystroke() {
    const now = Date.now();
    if (now - lastTypingCallAt.current > TYPING_THROTTLE_MS) {
      lastTypingCallAt.current = now;
      void setTyping({ scope });
    }
    if (stopTypingTimeout.current) clearTimeout(stopTypingTimeout.current);
    stopTypingTimeout.current = setTimeout(() => {
      void clearTyping({ scope });
    }, STOP_TYPING_DELAY_MS);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!content.trim() || sending) return;
    if (stopTypingTimeout.current) clearTimeout(stopTypingTimeout.current);
    setSending(true);
    try {
      if (scope.kind === "channel") {
        await sendMessage({ channelId: scope.channelId, content: content.trim() });
      } else {
        await sendDirectMessage({ threadId: scope.threadId, content: content.trim() });
      }
      await clearTyping({ scope });
      setContent("");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4">
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          handleKeystroke();
        }}
        onKeyDown={handleKeyDown}
        placeholder={scope.kind === "channel" ? "Message #general" : "Message"}
        rows={1}
        className="w-full resize-none rounded bg-discord-bg-tertiary px-3 py-2 text-discord-text-normal outline-none"
      />
    </form>
  );
}
