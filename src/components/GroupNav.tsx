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
    { href: `${base}/listings/new`, label: "+ Add listing" },
  ];
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-stone-200 text-sm">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`whitespace-nowrap border-b-2 px-3 py-2 ${
              active ? "border-teal-700 font-medium text-teal-800" : "border-transparent text-stone-600 hover:text-stone-900"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
