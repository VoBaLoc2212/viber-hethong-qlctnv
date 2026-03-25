"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/budgeting", label: "Budgeting" },
  { href: "/reports", label: "Security & Logs" },
  { href: "/transactions", label: "Transactions" },
  { href: "/approvals", label: "Approvals" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="main-nav">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={pathname === item.href ? "active" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
