"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Reuniones" },
  { href: "/secuencia", label: "Secuencia" },
  { href: "/ajustes", label: "Ajustes" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            pathname === l.href ? "bg-secondary text-primary" : "text-muted-foreground hover:text-primary",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
