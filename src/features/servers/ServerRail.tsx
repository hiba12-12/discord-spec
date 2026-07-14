import { useQuery } from "convex/react";
import { NavLink } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { UserStatusToggle } from "./UserStatusToggle";
import { ProfileButton } from "./ProfileButton";

export function ServerRail() {
  const servers = useQuery(api.servers.listMyServers);

  return (
    <nav className="flex w-[72px] shrink-0 flex-col items-center gap-2 bg-discord-bg-tertiary py-3">
      <NavLink
        to="/dms"
        className={({ isActive }) =>
          `flex h-12 w-12 items-center justify-center rounded-full text-xs font-semibold text-white transition-all hover:rounded-2xl ${
            isActive ? "rounded-2xl bg-discord-brand" : "bg-discord-bg-secondary"
          }`
        }
        title="Direct Messages"
      >
        DMs
      </NavLink>
      <div className="my-1 h-px w-8 bg-discord-bg-primary" />
      {servers === undefined && (
        <span className="text-xs text-discord-text-muted">...</span>
      )}
      {servers?.map((server) => (
        <NavLink
          key={server._id}
          to={`/servers/${server._id}`}
          className={({ isActive }) =>
            `flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white transition-all hover:rounded-2xl ${
              isActive ? "rounded-2xl bg-discord-brand" : "bg-discord-bg-secondary"
            }`
          }
          title={server.name}
        >
          {server.name.slice(0, 2).toUpperCase()}
        </NavLink>
      ))}
      <NavLink
        to="/servers"
        end
        className="flex h-12 w-12 items-center justify-center rounded-full bg-discord-bg-secondary text-2xl text-discord-online hover:rounded-2xl"
        title="Create a server"
      >
        +
      </NavLink>
      <div className="mt-auto flex flex-col items-center gap-2">
        <UserStatusToggle />
        <ProfileButton />
      </div>
    </nav>
  );
}
