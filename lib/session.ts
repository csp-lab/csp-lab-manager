import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isRole, type Role } from "@/lib/rbac";

export type SessionUser = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: Role;
};

export async function readSessionUser(headerStore: Headers): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: headerStore });
  if (!session) return null;
  const role = session.user.role;
  const username = session.user.username;
  if (!role || !isRole(role) || !username) return null;
  return {
    id: session.user.id,
    username,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    role,
  };
}

export async function requireUser() {
  const user = await readSessionUser(await headers());
  if (!user) redirect("/admin/login");
  return user;
}
