"use client";

import { useActionState } from "react";
import { updatePassword, type AuthState } from "@/app/auth/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PasswordInput } from "@/components/ui/PasswordInput";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const initial: AuthState = {};

export default function UpdatePasswordPage() {
  const [state, action] = useActionState(updatePassword, initial);

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        Set a new password
      </h1>
      <p className="mt-1 text-sm text-muted">
        Enter a new password for your account.
      </p>

      <form action={action} className="mt-6 space-y-3">
        <PasswordInput
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="New password (min 8 characters)"
          className={inputClass}
          aria-label="New password"
        />
        {state.error && (
          <p role="alert" className="text-sm text-urgent">
            {state.error}
          </p>
        )}
        <SubmitButton pendingText="Saving…" className="w-full">
          Update Password
        </SubmitButton>
      </form>
    </main>
  );
}
