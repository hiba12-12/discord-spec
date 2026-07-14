import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

// research.md §1: profile() writes our app-specific fields (displayName, avatarUrl) onto
// the extended `users` table at signup time. Convex Auth's Password provider has no
// documented per-failed-attempt hook, so login rate-limiting (FR-001a) is handled separately
// in users.ts via a client-orchestrated checkLoginAllowed/recordLoginResult pair — not here.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const avatarUrl = params.avatarUrl as string | undefined;
        return {
          email: params.email as string,
          displayName: params.displayName as string,
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        };
      },
    }),
  ],
});
