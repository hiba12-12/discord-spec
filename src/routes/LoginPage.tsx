import { Link } from "react-router-dom";
import { LoginForm } from "../features/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-discord-bg-tertiary">
      <LoginForm />
      <p className="text-sm text-discord-text-muted">
        Need an account?{" "}
        <Link to="/signup" className="text-discord-text-link hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
