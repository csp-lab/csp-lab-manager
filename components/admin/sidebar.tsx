"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, LogOut, Plus, Users } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { canManageEndpoints, canManageUsers, type Role } from "@/lib/rbac";
import { cn } from "@/lib/utils";

export function Sidebar({
  user,
}: {
  user: { username: string; firstName: string; lastName: string; role: Role };
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  const item = (href: string, label: string, icon: React.ReactNode) => (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded px-3 py-2 font-mono text-[13px]",
        pathname === href || pathname.startsWith(`${href}/`)
          ? "bg-terminal text-white"
          : "text-secondary hover:bg-white/70",
      )}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <aside className="flex flex-col gap-6 border-r border-line bg-panel/90 p-4 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
      <Link href="/admin/endpoints" className="wordmark">
        <span className="wordmark-mark" />
        CSP Lab Manager
      </Link>
      {canManageEndpoints(user.role) ? (
        <Link
          href="/admin/endpoints/new"
          className="inline-flex items-center justify-center gap-2 rounded bg-terminal px-4 py-2 font-mono text-[13px] text-white hover:opacity-90"
        >
          <Plus size={14} />
          Create Endpoint
        </Link>
      ) : null}
      <nav className="flex flex-col gap-1">
        {item("/admin/endpoints", "Endpoints", <LayoutGrid size={14} />)}
        {canManageUsers(user.role) ? item("/admin/users", "Users", <Users size={14} />) : null}
      </nav>
      <div className="mt-auto border-t border-line pt-4">
        <p className="text-[13px] font-semibold">
          {user.firstName} {user.lastName}
        </p>
        <p className="font-mono text-[11px] tracking-wide text-muted">
          {user.username} · {user.role}
        </p>
        <button
          type="button"
          onClick={signOut}
          className="mt-3 inline-flex items-center gap-2 rounded border border-line bg-card px-3 py-1.5 text-[13px]"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
