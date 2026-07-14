import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { clearPendingInviteCode } from "../lib/pendingInvite";

export default function JoinInvitePage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const joinByInvite = useMutation(api.servers.joinByInvite);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!inviteCode || attempted.current) return;
    attempted.current = true;
    clearPendingInviteCode();

    joinByInvite({ inviteCode })
      .then((serverId) => navigate(`/servers/${serverId}`, { replace: true }))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not join that server");
      });
  }, [inviteCode, joinByInvite, navigate]);

  return (
    <div className="flex h-full items-center justify-center bg-discord-bg-primary text-discord-text-normal">
      {error ? (
        <p className="text-discord-danger">{error}</p>
      ) : (
        <p className="text-discord-text-muted">Joining server...</p>
      )}
    </div>
  );
}
