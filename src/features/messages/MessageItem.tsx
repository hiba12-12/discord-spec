import { useState, type FormEvent } from "react";
import type { Id } from "../../../convex/_generated/dataModel";

export interface DisplayMessage {
  _id: Id<"messages"> | Id<"directMessages">;
  _creationTime: number;
  authorId: Id<"users">;
  content: string;
  editedAt?: number;
  authorDisplayName: string;
  authorAvatarUrl?: string;
}

export function MessageItem({
  message,
  isOwnMessage,
  onEdit,
  onDelete,
}: {
  message: DisplayMessage;
  isOwnMessage: boolean;
  onEdit: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  async function handleEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.trim()) return;
    await onEdit(draft.trim());
    setEditing(false);
  }

  return (
    <div className="group flex gap-3 px-4 py-1 hover:bg-discord-bg-secondary/40">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-discord-brand text-sm font-semibold text-white">
        {message.authorDisplayName.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-discord-text-normal">
            {message.authorDisplayName}
          </span>
          <span className="text-xs text-discord-text-muted">
            {new Date(message._creationTime).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
        {editing ? (
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="rounded bg-discord-bg-tertiary px-2 py-1 text-sm text-discord-text-normal outline-none"
            />
            <div className="flex gap-2 text-xs text-discord-text-muted">
              <button type="submit" className="text-discord-text-link hover:underline">
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(message.content);
                  setEditing(false);
                }}
                className="hover:underline"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm text-discord-text-normal">
            {message.content}
            {message.editedAt !== undefined && (
              <span className="ml-1 text-xs text-discord-text-muted">(edited)</span>
            )}
          </p>
        )}
      </div>
      {isOwnMessage && !editing && (
        <span className="hidden shrink-0 gap-2 text-xs text-discord-text-muted group-hover:flex">
          <button type="button" onClick={() => setEditing(true)} className="hover:text-discord-text-normal">
            Edit
          </button>
          <button type="button" onClick={() => onDelete()} className="hover:text-discord-danger">
            Delete
          </button>
        </span>
      )}
    </div>
  );
}
