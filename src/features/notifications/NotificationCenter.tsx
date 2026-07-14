import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface Toast {
  id: string;
  title: string;
  body: string;
  path: string;
}

const TOAST_LIFETIME_MS = 6_000;

export function NotificationCenter() {
  const navigate = useNavigate();
  const location = useLocation();
  const sinceRef = useRef(Date.now());
  const seenKeysRef = useRef(new Set<string>());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const events = useQuery(api.notifications.listMyRecentActivity, { since: sinceRef.current });

  useEffect(() => {
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!events) return;

    for (const event of events) {
      if (seenKeysRef.current.has(event.key)) continue;
      seenKeysRef.current.add(event.key);

      const path =
        event.scope.kind === "channel"
          ? `/servers/${event.scope.serverId}/${event.scope.channelId}`
          : `/dms/${event.scope.threadId}`;

      // Don't interrupt someone already looking at the exact conversation this event is from,
      // as long as they're actually looking at the tab right now.
      const alreadyViewing = location.pathname === path && document.hasFocus();
      if (alreadyViewing) continue;

      const contextLabel =
        event.scope.kind === "channel"
          ? `#${event.scope.channelName} in ${event.scope.serverName}`
          : "Direct Message";
      const title =
        event.type === "call"
          ? `Incoming call — ${contextLabel}`
          : `${event.authorDisplayName} — ${contextLabel}`;
      const body =
        event.type === "call"
          ? `${event.authorDisplayName} started a call`
          : (event.preview ?? "New message");

      setToasts((prev) => [...prev, { id: event.key, title, body, path }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== event.key));
      }, TOAST_LIFETIME_MS);

      if (document.hidden && Notification.permission === "granted") {
        const notification = new Notification(title, { body });
        notification.onclick = () => {
          window.focus();
          navigate(path);
        };
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function handleClick(toast: Toast) {
    dismiss(toast.id);
    navigate(toast.path);
  }

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto w-72 cursor-pointer rounded-md bg-discord-bg-secondary p-3 shadow-lg ring-1 ring-black/20"
          onClick={() => handleClick(toast)}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-discord-text-normal">
              {toast.title}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismiss(toast.id);
              }}
              aria-label="Dismiss notification"
              className="text-discord-text-muted hover:text-discord-text-normal"
            >
              ✕
            </button>
          </div>
          <p className="truncate text-xs text-discord-text-muted">{toast.body}</p>
        </div>
      ))}
    </div>
  );
}
