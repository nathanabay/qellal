"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Header nav link that highlights the active section (§9 nav-state-active)
// and meets the touch-target minimum.
export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        active
          ? "bg-primary-soft text-primary"
          : "text-muted hover:bg-primary-soft hover:text-primary"
      }`}
    >
      {children}
    </Link>
  );
}
