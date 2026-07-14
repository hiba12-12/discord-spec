import { useParams, Navigate } from "react-router-dom";
import { setPendingInviteCode } from "../lib/pendingInvite";

export default function PendingInviteRedirect() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  if (inviteCode) {
    setPendingInviteCode(inviteCode);
  }
  return <Navigate to="/login" replace />;
}
