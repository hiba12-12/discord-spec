import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { InviteControls } from "./InviteControls";

export function ServerSettings({
  serverId,
  serverName,
  inviteCode,
  isOwner,
}: {
  serverId: Id<"servers">;
  serverName: string;
  inviteCode: string;
  isOwner: boolean;
}) {
  const renameServer = useMutation(api.servers.renameServer);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(serverName);
  const [submitting, setSubmitting] = useState(false);

  async function handleRename(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || name.trim() === serverName) {
      setEditingName(false);
      return;
    }
    setSubmitting(true);
    try {
      await renameServer({ serverId, name: name.trim() });
      setEditingName(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-b border-discord-bg-tertiary p-3">
      {isOwner && editingName ? (
        <form onSubmit={handleRename} className="flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 rounded bg-discord-bg-tertiary px-2 py-1 text-sm text-discord-text-normal outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-discord-brand px-2 py-1 text-sm font-medium text-white hover:bg-discord-brand-hover disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setName(serverName);
              setEditingName(false);
            }}
            className="rounded px-2 py-1 text-sm text-discord-text-muted hover:text-discord-text-normal"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex items-center justify-between">
          <h2 className="truncate font-semibold text-discord-text-normal">{serverName}</h2>
          {isOwner && (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              title="Rename server"
              aria-label="Rename server"
              className="text-sm text-discord-text-muted hover:text-discord-text-normal"
            >
              ✏️
            </button>
          )}
        </div>
      )}
      <InviteControls serverId={serverId} inviteCode={inviteCode} isOwner={isOwner} />
    </div>
  );
}
