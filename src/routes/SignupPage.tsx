import { Link } from "react-router-dom";
import { SignupForm } from "../features/auth/SignupForm";

export default function SignupPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-discord-bg-tertiary">
      <SignupForm />
      <p className="text-sm text-discord-text-muted">
        Already have an account?{" "}
        <Link to="/login" className="text-discord-text-link hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
