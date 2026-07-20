import { BrandMark } from "@/components/ui/BrandMark";

// Ink brand panel shown beside the auth forms on desktop (stacks away on mobile).
export function AuthBrandPanel() {
  return (
    <div className="hidden flex-col justify-between bg-ink p-8 text-canvas lg:flex">
      <div className="flex items-center gap-2 font-heading text-lg font-bold">
        <BrandMark tone="dark" />
        Qellal
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-canvas/60">
          Every Ethiopian tender · One place
        </p>
        <h2 className="mt-3 font-heading text-3xl font-bold leading-tight">
          Never miss a tender deadline again.
        </h2>
        <p className="mt-3 text-sm text-canvas/70">
          Save a search and we’ll alert you by email &amp; Telegram — with
          reminders 7, 3 and 1 day before each deadline closes.
        </p>
      </div>
      <p className="font-mono text-xs text-canvas/50">
        Email &amp; Telegram · Free to start
      </p>
    </div>
  );
}
