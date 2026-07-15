"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type AuthState } from "@/app/auth/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PasswordInput } from "@/components/ui/PasswordInput";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const initial: AuthState = {};

export default function SignupPage() {
  const [state, action] = useActionState(signup, initial);

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        Create your account
      </h1>
      <p className="mt-1 text-sm text-muted">
        Save filters and get deadline alerts by email &amp; Telegram.
      </p>

      {state.message ? (
        <div className="mt-6 rounded-xl border border-primary/30 bg-primary-soft p-4 text-sm text-primary">
          {state.message}
        </div>
      ) : (
        <form action={action} className="mt-6 space-y-3">
          <input
            name="full_name"
            type="text"
            autoComplete="name"
            placeholder="Full name (optional)"
            className={inputClass}
            aria-label="Full name"
          />
          <input
            name="company_name"
            type="text"
            autoComplete="organization"
            placeholder="Company / organisation (optional)"
            className={inputClass}
            aria-label="Company or organisation"
          />
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={inputClass}
            aria-label="Email"
          />
          <PasswordInput
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Password (min 8 characters)"
            className={inputClass}
            aria-label="Password"
          />
          {state.error && (
            <p role="alert" className="text-sm text-urgent">
              {state.error}
            </p>
          )}
          <SubmitButton pendingText="Creating account…" className="w-full">
            Create account
          </SubmitButton>
        </form>
      )}

      <p className="mt-4 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:text-primary-hover">
          Sign in
        </Link>
      </p>
    </main>
  );
}
