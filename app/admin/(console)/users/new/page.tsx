import { connection } from "next/server";
import { redirect } from "next/navigation";
import { UserForm } from "@/components/admin/user-form";
import { canManageUsers } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const instant = false;

export default async function Page() {
  await connection();
  const user = await requireUser();
  if (!canManageUsers(user.role)) redirect("/admin/endpoints");
  return (
    <>
      <header>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Create user</h1>
        <p className="mt-1 text-[15px] text-secondary">Viewers only see endpoints assigned to them.</p>
      </header>
      <UserForm actorRole={user.role} />
    </>
  );
}
