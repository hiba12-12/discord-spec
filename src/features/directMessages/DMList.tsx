import { NavLink } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function DMList() {
  const threads = useQuery(api.directMessageThreads.listMyThreads);

  return (
    <div className="flex w-60 shrink-0 flex-col bg-discord-bg-secondary p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase text-discord-text-muted">
        Direct Messages
      </h3>
      <ul className="flex flex-col gap-0.5">
        {threads?.map((thread) => (
          <li key={thread._id}>
            <NavLink
              to={`/dms/${thread._id}`}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-discord-bg-primary hover:text-discord-text-normal ${
                  isActive ? "bg-discord-bg-primary text-discord-text-normal" : "text-discord-text-muted"
                }`
              }
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-discord-brand text-xs font-semibold text-white">
                {thread.otherUserDisplayName.slice(0, 1).toUpperCase()}
              </span>
              <span className="truncate">{thread.otherUserDisplayName}</span>
            </NavLink>
          </li>
        ))}
        {threads?.length === 0 && (
          <p className="px-2 text-xs text-discord-text-muted">
            No conversations yet. Message someone from a server's member list to start one.
          </p>
        )}
      </ul>
    </div>
  );
}
