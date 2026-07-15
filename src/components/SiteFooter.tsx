import Link from "next/link";

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h2>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-slate-300 transition-colors hover:text-white"
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
    <footer className="mt-20 bg-navy text-slate-300">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 font-heading text-lg font-bold text-white">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full bg-primary"
              />
              Qellal
            </div>
            <p className="mt-3 max-w-xs text-sm text-slate-400">
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
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Sources
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              Aggregated from public Ethiopian tender notices. Every listing
              links to its original source.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col justify-between gap-2 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row">
          <span>© 2026 Qellal · Ethiopian tender alerts</span>
          <span>Built for procurement teams who never miss a deadline.</span>
        </div>
      </div>
    </footer>
  );
}
