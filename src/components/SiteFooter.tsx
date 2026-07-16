import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-canvas/50">
        {title}
      </h2>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="rounded text-canvas/70 transition-colors hover:text-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-canvas/70"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-navy text-canvas/70">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 font-heading text-lg font-bold text-canvas">
              <BrandMark className="h-5 w-5" />
              Qellal
            </div>
            <p className="mt-3 max-w-xs text-sm text-canvas/60">
              Every Ethiopian tender notice in one place, with email &amp;
              Telegram alerts so you never miss a deadline.
            </p>
          </div>

          <FooterCol
            title="Product"
            links={[
              { label: "Browse tenders", href: "/tenders" },
              { label: "Create free account", href: "/signup" },
              { label: "Sign in", href: "/login" },
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              { label: "About", href: "/" },
              { label: "Privacy", href: "/" },
              { label: "Terms", href: "/" },
            ]}
          />
          <div>
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-canvas/50">
              Sources
            </h2>
            <p className="mt-3 text-sm text-canvas/60">
              Aggregated from public Ethiopian tender notices. Every listing
              links to its original source.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col justify-between gap-2 border-t border-canvas/10 pt-6 text-xs text-canvas/50 sm:flex-row">
          <span>© 2026 Qellal · Ethiopian tender alerts</span>
          <span>Built for procurement teams who never miss a deadline.</span>
        </div>
      </div>
    </footer>
  );
}
