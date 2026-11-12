"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const active = usePathname().startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="rounded-lg px-2.5 py-1.5 text-sm text-dim no-underline hover:bg-panel hover:text-ink aria-[current=page]:bg-panel aria-[current=page]:text-ink"
    >
      {children}
    </Link>
  );
}
