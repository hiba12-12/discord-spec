import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

export function SignupForm() {
  const { signIn } = useAuthActions();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    formData.set("flow", "signUp");

    try {
      await signIn("password", formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-80 flex-col gap-3 rounded-md bg-discord-bg-secondary p-6"
    >
      <h1 className="mb-2 text-xl font-semibold text-discord-text-normal">Create an account</h1>
      <input
        name="displayName"
        type="text"
        placeholder="Display name"
        required
        className="rounded bg-discord-bg-tertiary px-3 py-2 text-discord-text-normal outline-none"
      />
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
        {submitting ? "Creating account..." : "Sign Up"}
      </button>
    </form>
  );
}
