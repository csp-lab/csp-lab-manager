export const ROLES = ["SUPERADMIN", "ADMIN", "VIEWER"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return ROLES.some((role) => role === value);
}

export function canManageEndpoints(role: Role) {
  return role === "SUPERADMIN" || role === "ADMIN";
}

export function canManageUsers(role: Role) {
  return role === "SUPERADMIN" || role === "ADMIN";
}

export function canEditRoles(role: Role) {
  return role === "SUPERADMIN";
}

export function canAssignAdminRole(role: Role) {
  return role === "SUPERADMIN";
}
