import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function CreateServerForm({ onCreated }: { onCreated?: () => void }) {
  const createServer = useMutation(api.servers.createServer);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const serverId: Id<"servers"> = await createServer({ name: name.trim() });
      setName("");
      onCreated?.();
      navigate(`/servers/${serverId}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
      <h2 className="text-lg font-semibold text-discord-text-normal">Create a Server</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Server name"
        required
        className="rounded bg-discord-bg-tertiary px-3 py-2 text-discord-text-normal outline-none"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-discord-brand px-3 py-2 font-medium text-white hover:bg-discord-brand-hover disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Create Server"}
      </button>
    </form>
  );
}
