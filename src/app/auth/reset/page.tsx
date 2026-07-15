"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type AuthState } from "@/app/auth/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const initial: AuthState = {};

export default function ResetPage() {
  const [state, action] = useActionState(requestPasswordReset, initial);

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        Reset password
      </h1>
      <p className="mt-1 text-sm text-muted">
        We&apos;ll email you a link to set a new password.
      </p>

      {state.message ? (
        <div className="mt-6 rounded-xl border border-primary/30 bg-primary-soft p-4 text-sm text-primary">
          {state.message}
        </div>
      ) : (
        <form action={action} className="mt-6 space-y-3">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={inputClass}
            aria-label="Email"
          />
          {state.error && (
            <p role="alert" className="text-sm text-urgent">
              {state.error}
            </p>
          )}
          <SubmitButton pendingText="Sending…" className="w-full">
            Send reset link
          </SubmitButton>
        </form>
      )}

      <p className="mt-4 text-sm text-muted">
        <Link href="/login" className="text-primary hover:text-primary-hover">
          ← Back to sign in
        </Link>
      </p>
    </main>
  );
}
