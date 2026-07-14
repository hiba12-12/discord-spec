import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

function extractInviteCode(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/invite\/([^/?#]+)/);
  return match?.[1] ?? trimmed;
}

export function JoinServerForm() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!value.trim()) return;
    navigate(`/invite/${extractInviteCode(value)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
      <h2 className="text-lg font-semibold text-discord-text-normal">Join a Server</h2>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Invite link or code"
        required
        className="rounded bg-discord-bg-tertiary px-3 py-2 text-discord-text-normal outline-none"
      />
      <button
        type="submit"
        className="rounded bg-discord-brand px-3 py-2 font-medium text-white hover:bg-discord-brand-hover"
      >
        Join Server
      </button>
    </form>
  );
}
