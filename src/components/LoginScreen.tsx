"use client";

import { useState, type FormEvent } from "react";
import { Map as MapIcon } from "lucide-react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { Button, Input, ThemeToggle } from "@ash2k5/ui";
import { auth } from "../lib/firebase";

const AUTH_ERRORS: Record<string, string> = {
  "auth/invalid-credential": "Invalid email or password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Try again later.",
  "auth/user-not-found": "No account found with that email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/email-already-in-use": "An account with that email already exists.",
  "auth/weak-password": "Password must be at least 6 characters.",
};

// Aurora + grain scoped to this surface (the DS AuroraBackground is a fixed page
// layer; here it sits inside the overlay above the always-mounted map).
const AURORA_GRADIENT =
  "radial-gradient(circle at 15% 50%, var(--aurora-1), transparent 50%), radial-gradient(circle at 85% 30%, var(--aurora-2), transparent 50%), radial-gradient(circle at 50% 80%, var(--aurora-3), transparent 50%)";
const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export default function LoginScreen() {
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const isLogin = authMode === "login";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError("");
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth!, email, password);
      } else {
        await createUserWithEmailAndPassword(auth!, email, password);
      }
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      const fallback = isLogin
        ? "Login failed. Check your credentials."
        : "Could not create account. Please try again.";
      setError(AUTH_ERRORS[code] || fallback);
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 isolate overflow-hidden bg-surface flex items-center justify-center p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80 [filter:blur(80px)] [@media(prefers-reduced-transparency:reduce)]:hidden"
        style={{ background: AURORA_GRADIENT }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] [mix-blend-mode:var(--grain-blend)]"
        style={{ backgroundImage: GRAIN_BG }}
      />

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <section aria-label="Sign in" className="relative z-10 w-full max-w-sm ds-glass ds-glass--floating p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="grid size-11 place-items-center bg-primary text-on-primary shrink-0">
            <MapIcon size={22} aria-hidden />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold leading-tight text-on-surface">
              UC CampusPathFinder
            </h1>
            <p className="ds-label-sm text-on-surface-variant">
              Sign in to continue
            </p>
          </div>
        </div>

        <div className="flex gap-1 mb-6 border border-outline-variant p-1">
          <button
            type="button"
            onClick={() => {
              setAuthMode("login");
              setError("");
            }}
            aria-pressed={isLogin}
            className={`flex-1 py-2 ds-label-sm transition-colors ${
              isLogin
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode("signup");
              setError("");
            }}
            aria-pressed={!isLogin}
            className={`flex-1 py-2 ds-label-sm transition-colors ${
              !isLogin
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@uc.edu"
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isLogin ? "Password" : "Password (min 6 characters)"}
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
          />
          {error && (
            <p role="alert" className="ds-body-sm font-semibold text-error">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            loading={isLoggingIn}
            className="w-full"
          >
            {isLoggingIn
              ? isLogin
                ? "Signing in..."
                : "Creating account..."
              : isLogin
                ? "Sign In"
                : "Create Account"}
          </Button>
        </form>
      </section>
    </div>
  );
}
