const PENDING_INVITE_KEY = "pendingInviteCode";

export function setPendingInviteCode(inviteCode: string): void {
  sessionStorage.setItem(PENDING_INVITE_KEY, inviteCode);
}

// Non-destructive read — safe to call from a render body (React 18 StrictMode double-invokes
// render functions in dev to catch impure side effects; a read-and-clear here would lose the
// code on the second invocation). Clear it explicitly via clearPendingInviteCode() once the
// code has actually been consumed by an effect (see JoinInvitePage).
export function peekPendingInviteCode(): string | null {
  return sessionStorage.getItem(PENDING_INVITE_KEY);
}

export function clearPendingInviteCode(): void {
  sessionStorage.removeItem(PENDING_INVITE_KEY);
}
