import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import LoginPage from "./routes/LoginPage";
import SignupPage from "./routes/SignupPage";
import ServerLayout from "./routes/ServerLayout";
import DMLayout from "./routes/DMLayout";
import JoinInvitePage from "./routes/JoinInvitePage";
import PendingInviteRedirect from "./routes/PendingInviteRedirect";
import { peekPendingInviteCode } from "./lib/pendingInvite";
import { ServerRail } from "./features/servers/ServerRail";
import { NotificationCenter } from "./features/notifications/NotificationCenter";

function LoadingScreen() {
  return (
    <div className="flex h-full items-center justify-center bg-discord-bg-tertiary text-discord-text-muted">
      Loading...
    </div>
  );
}

function AuthenticatedEntry() {
  const pendingInviteCode = peekPendingInviteCode();
  if (pendingInviteCode) {
    return <Navigate to={`/invite/${pendingInviteCode}`} replace />;
  }
  return <Navigate to="/servers" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthLoading>
        <LoadingScreen />
      </AuthLoading>
      <Unauthenticated>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/invite/:inviteCode" element={<PendingInviteRedirect />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Unauthenticated>
      <Authenticated>
        <NotificationCenter />
        <div className="flex h-full">
          <ServerRail />
          <Routes>
            <Route path="/servers/*" element={<ServerLayout />} />
            <Route path="/dms/*" element={<DMLayout />} />
            <Route path="/invite/:inviteCode" element={<JoinInvitePage />} />
            <Route path="*" element={<AuthenticatedEntry />} />
          </Routes>
        </div>
      </Authenticated>
    </BrowserRouter>
  );
}
