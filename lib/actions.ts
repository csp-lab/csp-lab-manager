"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canAssignAdminRole, canEditRoles, canManageEndpoints, canManageUsers } from "@/lib/rbac";
import { slugifyAppName } from "@/lib/report-fields";
import { createEndpointSchema, createUserSchema, reportQuerySchema, updateRoleSchema } from "@/lib/validations/forms";
import { provisionUser } from "@/lib/provision";
import { createApiKey } from "@/lib/api-key";
import { deleteAllReports, getEndpoint, listReports, removeReports } from "@/lib/queries";

export type ActionResult = { ok: true; slug?: string; apiKey?: string } | { ok: false; error: string };

function zodError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input";
}

export async function createEndpoint(input: { appName: string; apiKey: string }): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageEndpoints(user.role)) return { ok: false, error: "Forbidden" };
  const parsed = createEndpointSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) };
  const appNameSlug = slugifyAppName(parsed.data.appName);
  if (!appNameSlug) return { ok: false, error: "App name must produce a slug" };
  try {
    await prisma.endpoint.create({
      data: {
        appName: parsed.data.appName.trim(),
        appNameSlug,
        apiKey: parsed.data.apiKey,
        accessList: { create: { userId: user.id } },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "App name or API key already exists" };
    }
    throw error;
  }
  revalidatePath("/admin/endpoints");
  revalidatePath(`/admin/endpoints/${appNameSlug}`);
  return { ok: true, slug: appNameSlug, apiKey: parsed.data.apiKey };
}

export async function regenerateApiKey(slug: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageEndpoints(user.role)) return { ok: false, error: "Forbidden" };
  const endpoint = await getEndpoint(user, slug);
  if (!endpoint) return { ok: false, error: "Endpoint not found" };
  const apiKey = createApiKey();
  await prisma.endpoint.update({ where: { id: endpoint.id }, data: { apiKey } });
  revalidatePath(`/admin/endpoints/${slug}`);
  return { ok: true, apiKey };
}

export async function deleteEndpoint(slug: string, confirmation: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageEndpoints(user.role)) return { ok: false, error: "Forbidden" };
  if (confirmation !== slug) return { ok: false, error: "Type the endpoint slug to confirm" };
  const endpoint = await getEndpoint(user, slug);
  if (!endpoint) return { ok: false, error: "Endpoint not found" };
  await deleteAllReports(endpoint.id);
  await prisma.endpoint.delete({ where: { id: endpoint.id } });
  revalidatePath("/admin/endpoints");
  return { ok: true };
}

export async function clearReports(slug: string, confirmation: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageEndpoints(user.role)) return { ok: false, error: "Forbidden" };
  if (confirmation !== slug) return { ok: false, error: "Type the endpoint slug to confirm" };
  const endpoint = await getEndpoint(user, slug);
  if (!endpoint) return { ok: false, error: "Endpoint not found" };
  await deleteAllReports(endpoint.id);
  revalidatePath(`/admin/endpoints/${slug}`);
  return { ok: true };
}

export async function deleteReport(slug: string, reportId: string, grouped = false): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageEndpoints(user.role)) return { ok: false, error: "Forbidden" };
  const endpoint = await getEndpoint(user, slug);
  if (!endpoint) return { ok: false, error: "Endpoint not found" };
  const report = await prisma.report.findFirst({
    where: { id: reportId, endpointId: endpoint.id },
    select: { documentUri: true, violatedDirective: true, blockedUri: true, disposition: true },
  });
  if (!report) return { ok: false, error: "Report not found" };
  await removeReports(
    endpoint.id,
    grouped ? { endpointId: endpoint.id, ...report } : { id: reportId, endpointId: endpoint.id },
  );
  revalidatePath(`/admin/endpoints/${slug}`);
  revalidatePath("/admin/endpoints");
  return { ok: true };
}

export async function setEndpointAccess(slug: string, userIds: string[]): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageEndpoints(user.role)) return { ok: false, error: "Forbidden" };
  const endpoint = await getEndpoint(user, slug);
  if (!endpoint) return { ok: false, error: "Endpoint not found" };
  const managers = await prisma.user.findMany({
    where: { role: { in: ["SUPERADMIN", "ADMIN"] } },
    select: { id: true },
  });
  const uniqueIds = [...new Set([...userIds, ...managers.map((row) => row.id)])];
  const found = await prisma.user.count({ where: { id: { in: uniqueIds } } });
  if (found !== uniqueIds.length) return { ok: false, error: "Unknown user in access list" };
  await prisma.$transaction([
    prisma.endpointAccess.deleteMany({ where: { endpointId: endpoint.id } }),
    ...(uniqueIds.length
      ? [prisma.endpointAccess.createMany({ data: uniqueIds.map((userId) => ({ userId, endpointId: endpoint.id })) })]
      : []),
  ]);
  revalidatePath(`/admin/endpoints/${slug}`);
  return { ok: true };
}

export async function queryReports(input: unknown) {
  const user = await requireUser();
  const parsed = reportQuerySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: zodError(parsed.error) };
  const data = await listReports(user, parsed.data.slug, parsed.data);
  if (!data) return { ok: false as const, error: "Endpoint not found" };
  return {
    ok: true as const,
    data: { reports: data.reports, directives: data.directives, domains: data.domains, capped: data.capped },
  };
}

export async function createUser(input: unknown): Promise<ActionResult> {
  const actor = await requireUser();
  if (!canManageUsers(actor.role)) return { ok: false, error: "Forbidden" };
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) };
  if (parsed.data.role === "ADMIN" && !canAssignAdminRole(actor.role)) {
    return { ok: false, error: "Only a superadmin can assign the admin role" };
  }
  try {
    await provisionUser(parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
      /unique|already exists/i.test(message)
    ) {
      return { ok: false, error: "Username already exists" };
    }
    throw error;
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateUserRole(input: unknown): Promise<ActionResult> {
  const actor = await requireUser();
  if (!canEditRoles(actor.role)) return { ok: false, error: "Forbidden" };
  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) };
  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return { ok: false, error: "User not found" };
  if (parsed.data.role === "SUPERADMIN" && target.role !== "SUPERADMIN") {
    return { ok: false, error: "There can only be one superadmin" };
  }
  if (target.id === actor.id && parsed.data.role !== "SUPERADMIN") {
    return { ok: false, error: "You cannot change your own superadmin role" };
  }
  if (target.role === "SUPERADMIN" && parsed.data.role !== "SUPERADMIN") {
    const supers = await prisma.user.count({ where: { role: "SUPERADMIN" } });
    if (supers <= 1) return { ok: false, error: "Keep at least one superadmin" };
  }
  await prisma.user.update({ where: { id: target.id }, data: { role: parsed.data.role } });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const actor = await requireUser();
  if (!canManageUsers(actor.role)) return { ok: false, error: "Forbidden" };
  if (actor.id === userId) return { ok: false, error: "You cannot delete yourself" };
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "User not found" };
  if (actor.role === "ADMIN" && target.role === "SUPERADMIN") {
    return { ok: false, error: "Admins cannot delete a superadmin" };
  }
  if (target.role === "SUPERADMIN") {
    const supers = await prisma.user.count({ where: { role: "SUPERADMIN" } });
    if (supers <= 1) return { ok: false, error: "Keep at least one superadmin" };
  }
  await prisma.user.delete({ where: { id: target.id } });
  revalidatePath("/admin/users");
  return { ok: true };
}
