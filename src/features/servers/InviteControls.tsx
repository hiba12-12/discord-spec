import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function InviteControls({
  serverId,
  inviteCode,
  isOwner,
}: {
  serverId: Id<"servers">;
  inviteCode: string;
  isOwner: boolean;
}) {
  const regenerateInvite = useMutation(api.servers.regenerateInvite);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await regenerateInvite({ serverId });
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded bg-discord-bg-tertiary p-3">
      <h4 className="text-xs font-semibold uppercase text-discord-text-muted">Invite people</h4>
      <div className="flex gap-2">
        <input
          readOnly
          value={inviteUrl}
          className="min-w-0 flex-1 rounded bg-discord-bg-primary px-2 py-1 text-sm text-discord-text-normal outline-none"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded bg-discord-brand px-3 py-1 text-sm font-medium text-white hover:bg-discord-brand-hover"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {isOwner && (
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating}
          className="self-start text-xs text-discord-text-link hover:underline disabled:opacity-50"
        >
          {regenerating ? "Regenerating..." : "Generate new invite link"}
        </button>
      )}
    </div>
  );
}
