import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { UserList } from "@/components/admin/user-list";
import { listUsers } from "@/lib/queries";
import { canManageUsers } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const instant = false;

export default async function Page() {
  await connection();
  const user = await requireUser();
  if (!canManageUsers(user.role)) redirect("/admin/endpoints");
  const users = await listUsers();
  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-[15px] text-secondary">Roles control console access and endpoint assignment.</p>
        </div>
        <Link href="/admin/users/new" className="rounded bg-terminal px-4 py-2 font-mono text-[13px] text-white">
          Create user
        </Link>
      </header>
      <UserList
        actorId={user.id}
        actorRole={user.role}
        users={users.map((row) => ({ ...row, role: row.role }))}
      />
    </>
  );
}
