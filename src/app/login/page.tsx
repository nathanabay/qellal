"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type AuthState } from "@/app/auth/actions";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const btnClass =
  "w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60";

const initial: AuthState = {};

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Welcome back to Qellal.</p>

      <form action={action} className="mt-6 space-y-3">
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className={inputClass}
          aria-label="Email"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          className={inputClass}
          aria-label="Password"
        />
        {state.error && <p className="text-sm text-urgent">{state.error}</p>}
        <button type="submit" disabled={pending} className={btnClass}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-4 flex justify-between text-sm">
        <Link
          href="/auth/reset"
          className="text-primary hover:text-primary-hover"
        >
          Forgot password?
        </Link>
        <Link href="/signup" className="text-primary hover:text-primary-hover">
          Create account
        </Link>
      </div>
    </main>
  );
}
