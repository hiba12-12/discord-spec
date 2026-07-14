import { useState, type FormEvent } from "react";
import { Modal as DialogOverlay } from "../../components/Modal";

export function CreateChannelDialog({
  onCreate,
  onClose,
}: {
  onCreate: (name: string, type: "text" | "voice") => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "voice">("text");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onCreate(name.trim(), type);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogOverlay onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-discord-text-normal">Create Channel</h3>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Channel name"
          required
          className="rounded bg-discord-bg-tertiary px-3 py-2 text-discord-text-normal outline-none"
        />
        <div className="flex gap-4 text-sm text-discord-text-normal">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={type === "text"}
              onChange={() => setType("text")}
            />
            Text
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={type === "voice"}
              onChange={() => setType("voice")}
            />
            Voice
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-discord-text-muted hover:text-discord-text-normal"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-discord-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-discord-brand-hover disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </DialogOverlay>
  );
}

export function RenameChannelDialog({
  currentName,
  onRename,
  onClose,
}: {
  currentName: string;
  onRename: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onRename(name.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogOverlay onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-discord-text-normal">Rename Channel</h3>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Channel name"
          required
          className="rounded bg-discord-bg-tertiary px-3 py-2 text-discord-text-normal outline-none"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-discord-text-muted hover:text-discord-text-normal"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-discord-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-discord-brand-hover disabled:opacity-50"
          >
            {submitting ? "Renaming..." : "Rename"}
          </button>
        </div>
      </form>
    </DialogOverlay>
  );
}

export function DeleteChannelDialog({
  channelName,
  onConfirm,
  onClose,
}: {
  channelName: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogOverlay onClose={onClose}>
      <h3 className="text-lg font-semibold text-discord-text-normal">Delete Channel</h3>
      <p className="text-sm text-discord-text-muted">
        Are you sure you want to delete <span className="font-semibold">#{channelName}</span>?
        This will permanently delete its message history.
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded px-3 py-1.5 text-sm text-discord-text-muted hover:text-discord-text-normal"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="rounded bg-discord-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Deleting..." : "Delete Channel"}
        </button>
      </div>
    </DialogOverlay>
  );
}
