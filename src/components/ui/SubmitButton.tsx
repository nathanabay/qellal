"use client";

import { useFormStatus } from "react-dom";
import { SpinnerIcon } from "./icons";

type Variant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "invert"
  | "invert-outline"
  | "invert-ghost";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  pendingText?: string;
};

// min-h-11 (44px) meets the touch-target minimum; focus-visible ring + cursor
// handle a11y/affordance; useFormStatus disables + shows a spinner while the
// server action runs (critical feedback on slow 3G).
const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary",
  secondary:
    "border border-border text-ink hover:bg-primary-soft hover:text-primary focus-visible:ring-primary",
  ghost:
    "font-medium text-muted hover:bg-primary-soft hover:text-primary focus-visible:ring-primary",
  danger: "border border-border text-urgent hover:bg-urgent-soft focus-visible:ring-primary",
  // For use on dark ink surfaces; light focus ring stays visible.
  invert: "bg-canvas text-ink hover:bg-hairline focus-visible:ring-canvas",
  "invert-outline":
    "border border-canvas/30 text-canvas hover:bg-white/10 focus-visible:ring-canvas",
  "invert-ghost":
    "font-medium text-canvas/70 underline underline-offset-2 hover:text-canvas focus-visible:ring-canvas",
};

export function SubmitButton({
  children,
  variant = "primary",
  pendingText,
  className = "",
  ...props
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {pending && <SpinnerIcon />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
