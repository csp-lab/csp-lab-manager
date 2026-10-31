import { Suspense } from "react";
import { connection } from "next/server";
import { QueryProvider } from "@/components/query-provider";
import { Sidebar } from "@/components/admin/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { requireUser } from "@/lib/session";

export const instant = false;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<div className="grid-bg min-h-screen" />}>
        <Shell>{children}</Shell>
      </Suspense>
      <Toaster />
    </>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  await connection();
  const user = await requireUser();
  return (
    <QueryProvider>
      <div className="grid-bg min-h-screen md:grid md:grid-cols-[240px_1fr]">
        <Sidebar user={user} />
        <div className="min-w-0">
          <div className="h-px bg-[#0a1c27]" />
          <main className="flex flex-col gap-6 p-6">{children}</main>
        </div>
      </div>
    </QueryProvider>
  );
}
