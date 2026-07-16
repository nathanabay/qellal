"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  InboxIcon,
  UsersIcon,
  BellIcon,
  TagIcon,
  DocumentIcon,
  AlertIcon,
} from "@/components/ui/icons";
import { BrandMark } from "@/components/ui/BrandMark";

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
    {
      href: "/admin/invoices",
      label: "Invoices",
      Icon: DocumentIcon,
      show: role === "admin",
    },
    {
      href: "/admin/dunning",
      label: "Dunning",
      Icon: AlertIcon,
      show: role === "admin",
    },
    {
      href: "/admin/plans",
      label: "Plans & roles",
      Icon: TagIcon,
      show: role === "admin",
    },
  ].filter((i) => i.show);

  const linkClass = (active: boolean) =>
    `flex min-h-11 items-center gap-2 px-3 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-canvas ${
      active
        ? "rounded-md border-l-[3px] border-urgent bg-canvas font-semibold text-ink"
        : "rounded-lg text-canvas/70 hover:bg-white/10 hover:text-canvas"
    }`;

  return (
    <nav className="rounded-xl border-transparent bg-ink p-2 text-sm text-canvas lg:sticky lg:top-20">
      <div className="flex items-center gap-2 px-3 pb-2 pt-2 font-heading text-base font-bold text-canvas">
        <BrandMark className="h-5 w-5" tone="dark" />
        Qellal
      </div>
      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-canvas/50">
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
      <div className="my-2 border-t border-canvas/15" />
      <Link
        href="/tenders"
        className="flex min-h-11 items-center gap-2 rounded-lg px-3 font-medium text-canvas/60 hover:bg-white/10 hover:text-canvas"
      >
        View site
      </Link>
    </nav>
  );
}
