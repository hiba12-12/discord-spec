import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import { Modal } from "../../components/Modal";

export function ProfileSettingsModal({
  currentDisplayName,
  currentAvatarUrl,
  onClose,
}: {
  currentDisplayName: string;
  currentAvatarUrl?: string;
  onClose: () => void;
}) {
  const updateProfile = useMutation(api.users.updateProfile);
  const { signOut } = useAuthActions();
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogOut() {
    await signOut();
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-discord-text-normal">Your Profile</h3>
        <label className="flex flex-col gap-1 text-xs text-discord-text-muted">
          Display name
          <input
            autoFocus
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="rounded bg-discord-bg-tertiary px-3 py-2 text-sm text-discord-text-normal outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-discord-text-muted">
          Avatar image URL
          <input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
            className="rounded bg-discord-bg-tertiary px-3 py-2 text-sm text-discord-text-normal outline-none"
          />
        </label>
        {error && <p className="text-xs text-discord-danger">{error}</p>}
        <div className="flex items-center justify-between border-t border-discord-bg-tertiary pt-3">
          <button
            type="button"
            onClick={handleLogOut}
            className="text-sm text-discord-danger hover:underline"
          >
            Log Out
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-sm text-discord-text-muted hover:text-discord-text-normal"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-discord-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-discord-brand-hover disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
