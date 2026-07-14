import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function LoginForm() {
  const { signIn } = useAuthActions();
  const convex = useConvex();
  const recordLoginResult = useMutation(api.users.recordLoginResult);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email"));
    formData.set("flow", "signIn");

    try {
      const { allowed } = await convex.query(api.users.checkLoginAllowed, { email });
      if (!allowed) {
        setError("Too many failed attempts. Try again in a minute.");
        return;
      }
      await signIn("password", formData);
      await recordLoginResult({ email, success: true });
    } catch (err) {
      await recordLoginResult({ email, success: false });
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-80 flex-col gap-3 rounded-md bg-discord-bg-secondary p-6"
    >
      <h1 className="mb-2 text-xl font-semibold text-discord-text-normal">Welcome back</h1>
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="rounded bg-discord-bg-tertiary px-3 py-2 text-discord-text-normal outline-none"
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        required
        className="rounded bg-discord-bg-tertiary px-3 py-2 text-discord-text-normal outline-none"
      />
      {error && <p className="text-sm text-discord-danger">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-discord-brand px-3 py-2 font-medium text-white hover:bg-discord-brand-hover disabled:opacity-50"
      >
        {submitting ? "Logging in..." : "Log In"}
      </button>
    </form>
  );
}
