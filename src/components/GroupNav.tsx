"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function GroupNav({ code }: { code: string }) {
  const pathname = usePathname();
  const base = `/g/${code}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/constraints`, label: "My constraints" },
    { href: `${base}/listings`, label: "Listings" },
  ];
  const addHref = `${base}/listings/new`;
  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Group">
      <div className="flex gap-1 overflow-x-auto rounded-full border-2 border-edge bg-paper p-1">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3.5 py-2 text-sm whitespace-nowrap ${
                active ? "bg-night font-bold text-white" : "font-medium text-muted hover:bg-soft hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <Link href={addHref} aria-current={pathname === addHref ? "page" : undefined} className="btn-primary ml-auto">
        + Add listing
      </Link>
    </nav>
  );
}
