import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function UserStatusToggle() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const setStatus = useMutation(api.users.setStatus);

  if (!currentUser) return null;
  const isInvisible = currentUser.status === "invisible";

  return (
    <button
      type="button"
      onClick={() => setStatus({ status: isInvisible ? "online" : "invisible" })}
      title={isInvisible ? "Appearing offline — click to appear online" : "Appear offline"}
      className="flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-full bg-discord-bg-secondary text-[10px] leading-none text-discord-text-muted hover:rounded-2xl hover:text-discord-text-normal"
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          isInvisible ? "bg-discord-offline" : "bg-discord-online"
        }`}
      />
      {isInvisible ? "Hidden" : "Online"}
    </button>
  );
}
