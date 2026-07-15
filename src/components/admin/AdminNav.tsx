"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { InboxIcon, UsersIcon, BellIcon } from "@/components/ui/icons";

// Admin sidebar with exact-match active state.
export function AdminNav({ role }: { role: string }) {
  const pathname = usePathname();

  const items = [
    { href: "/admin", label: "Review queue", Icon: InboxIcon, show: true },
    { href: "/admin/users", label: "Users", Icon: UsersIcon, show: role === "admin" },
    {
      href: "/admin/subscriptions",
      label: "Subscriptions",
      Icon: BellIcon,
      show: true,
    },
  ].filter((i) => i.show);

  const linkClass = (active: boolean) =>
    `flex min-h-11 items-center gap-2 rounded-lg px-3 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      active
        ? "bg-primary-soft text-primary"
        : "text-muted hover:bg-primary-soft hover:text-primary"
    }`;

  return (
    <nav className="rounded-xl border border-border bg-surface p-2 text-sm lg:sticky lg:top-20">
      <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Admin · {role}
      </p>
      {items.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={linkClass(active)}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
      <div className="my-2 border-t border-border" />
      <Link
        href="/tenders"
        className="flex min-h-11 items-center gap-2 rounded-lg px-3 font-medium text-muted hover:bg-primary-soft hover:text-primary"
      >
        View site
      </Link>
    </nav>
  );
}
