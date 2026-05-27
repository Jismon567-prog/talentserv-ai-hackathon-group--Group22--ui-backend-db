"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import {
  Activity,
  LayoutDashboard,
  FileText,
  FlaskConical,
  Database,
  ShieldCheck,
  Settings,
  TestTube2,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/agent-tests", label: "Agent QA", icon: TestTube2 },
  { href: "/dashboard/requirements", label: "Requirements", icon: FileText },
  { href: "/dashboard/test-cases", label: "Test Cases", icon: FlaskConical },
  { href: "/dashboard/data", label: "Synthetic Data", icon: Database },
  { href: "/dashboard/safety", label: "Safety & Audit", icon: ShieldCheck },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-background">
        <div className="flex h-16 items-center gap-2 border-b border-border px-6 font-semibold">
          <Activity className="h-5 w-5 text-blue-600" />
          <span>OpenMRS AI Agent</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          Synthetic data only — no PHI.
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
          <div className="md:hidden flex items-center gap-2 font-semibold">
            <Activity className="h-5 w-5 text-blue-600" />
            <span>OpenMRS AI Agent</span>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                },
              }}
            />
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
