import { useEffect, useRef } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { MessageScope } from "../../lib/messageScope";
import { reverseForDisplay } from "../../lib/messages";
import { MessageItem, type DisplayMessage } from "./MessageItem";

const PAGE_SIZE = 25;
const NEAR_EDGE_THRESHOLD_PX = 100;

export function MessageList({ scope }: { scope: MessageScope }) {
  const currentUser = useQuery(api.users.getCurrentUser);

  const channelPage = usePaginatedQuery(
    api.messages.listMessages,
    scope.kind === "channel" ? { channelId: scope.channelId } : "skip",
    { initialNumItems: PAGE_SIZE },
  );
  const threadPage = usePaginatedQuery(
    api.directMessages.listDirectMessages,
    scope.kind === "thread" ? { threadId: scope.threadId } : "skip",
    { initialNumItems: PAGE_SIZE },
  );
  const { status, loadMore } = scope.kind === "channel" ? channelPage : threadPage;

  const results: DisplayMessage[] =
    scope.kind === "channel"
      ? channelPage.results.map((m) => ({
          _id: m._id,
          _creationTime: m._creationTime,
          authorId: m.authorId,
          content: m.content,
          editedAt: m.editedAt,
          authorDisplayName: m.authorDisplayName,
          authorAvatarUrl: m.authorAvatarUrl,
        }))
      : threadPage.results.map((m) => ({
          _id: m._id,
          _creationTime: m._creationTime,
          authorId: m.authorId,
          content: m.content,
          editedAt: m.editedAt,
          authorDisplayName: m.authorDisplayName,
          authorAvatarUrl: m.authorAvatarUrl,
        }));

  const editMessage = useMutation(api.messages.editMessage);
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const editDirectMessage = useMutation(api.directMessages.editDirectMessage);
  const deleteDirectMessage = useMutation(api.directMessages.deleteDirectMessage);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevScrollHeightBeforeLoadMore = useRef<number | null>(null);
  const prevResultsLength = useRef(results.length);
  const isNearBottom = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (prevScrollHeightBeforeLoadMore.current !== null) {
      // Just loaded an older page — preserve the user's viewport position.
      container.scrollTop = container.scrollHeight - prevScrollHeightBeforeLoadMore.current;
      prevScrollHeightBeforeLoadMore.current = null;
    } else if (results.length > prevResultsLength.current && isNearBottom.current) {
      // A new message arrived and the user was already near the bottom — follow it.
      container.scrollTop = container.scrollHeight;
    }
    prevResultsLength.current = results.length;
  }, [results.length]);

  function handleScroll() {
    const container = containerRef.current;
    if (!container) return;

    isNearBottom.current =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      NEAR_EDGE_THRESHOLD_PX;

    if (container.scrollTop < NEAR_EDGE_THRESHOLD_PX && status === "CanLoadMore") {
      prevScrollHeightBeforeLoadMore.current = container.scrollHeight;
      loadMore(PAGE_SIZE);
    }
  }

  const displayMessages = reverseForDisplay(results);

  return (
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-2">
      {status === "LoadingMore" && (
        <div className="py-2 text-center text-xs text-discord-text-muted">
          Loading older messages...
        </div>
      )}
      {displayMessages.map((message) => (
        <MessageItem
          key={message._id}
          message={message}
          isOwnMessage={currentUser?._id === message.authorId}
          onEdit={async (content) => {
            if (scope.kind === "channel") {
              await editMessage({ messageId: message._id as Id<"messages">, content });
            } else {
              await editDirectMessage({ messageId: message._id as Id<"directMessages">, content });
            }
          }}
          onDelete={async () => {
            if (scope.kind === "channel") {
              await deleteMessage({ messageId: message._id as Id<"messages"> });
            } else {
              await deleteDirectMessage({ messageId: message._id as Id<"directMessages"> });
            }
          }}
        />
      ))}
    </div>
  );
}
