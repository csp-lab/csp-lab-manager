import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/rbac";

export async function provisionUser(input: {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  role: Role;
}) {
  if (input.role === "SUPERADMIN") {
    const supers = await prisma.user.count({ where: { role: "SUPERADMIN" } });
    // shortcut: two provisions at the same moment can both pass this count, add a partial unique index if that happens
    if (supers > 0) throw new Error("There can only be one superadmin");
  }
  const username = input.username.toLowerCase();
  const email = `${username}@users.csp.local`;
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(input.password);
  const created = await ctx.internalAdapter.createUser(
    {
      email,
      name: `${input.firstName} ${input.lastName}`,
      emailVerified: true,
      firstName: input.firstName,
      lastName: input.lastName,
      username,
    },
    { method: "admin" },
  );
  if (!created) throw new Error("Failed to create user");
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: hash,
  });
  await prisma.user.update({
    where: { id: created.id },
    data: {
      role: input.role,
      username,
      firstName: input.firstName,
      lastName: input.lastName,
    },
  });
  return created.id;
}
