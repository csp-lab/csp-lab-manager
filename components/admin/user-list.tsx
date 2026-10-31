"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteUser, updateUserRole } from "@/lib/actions";
import { canEditRoles, type Role } from "@/lib/rbac";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Row = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  role: Role;
  createdAt: string;
};

export function UserList({ users, actorId, actorRole }: { users: Row[]; actorId: string; actorRole: Role }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function onRole(user: Row, role: string) {
    setError("");
    const result = await updateUserRole({ userId: user.id, role });
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(`${user.username} is now ${role}`);
    router.refresh();
  }

  async function onDelete() {
    if (!pendingId) return;
    const username = users.find((row) => row.id === pendingId)?.username ?? "user";
    setError("");
    const result = await deleteUser(pendingId);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
    } else {
      toast.success(`Deleted ${username}`);
    }
    setPendingId(null);
    router.refresh();
  }

  return (
    <div>
      {error ? <p className="mb-3 text-[13px] text-brand">{error}</p> : null}
      <div className="overflow-x-auto rounded-md border border-line bg-card">
        <table className="w-full min-w-[640px] text-left text-[15px]">
          <thead className="font-mono text-[11px] tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-line">
                <td className="px-4 py-3">
                  {user.firstName} {user.lastName}
                </td>
                <td className="px-4 py-3 font-mono text-[13px]">{user.username}</td>
                <td className="px-4 py-3">
                  {canEditRoles(actorRole) && !(user.role === "SUPERADMIN" && user.id === actorId) ? (
                    <Select value={user.role} onValueChange={(role) => onRole(user, role)}>
                      <SelectTrigger className="h-8 w-auto text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {user.role === "SUPERADMIN" ? <SelectItem value="SUPERADMIN">SUPERADMIN</SelectItem> : null}
                        <SelectItem value="ADMIN">ADMIN</SelectItem>
                        <SelectItem value="VIEWER">VIEWER</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <RoleBadge role={user.role} />
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted">{user.createdAt.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  {user.id !== actorId ? (
                    <button type="button" onClick={() => setPendingId(user.id)} className="font-mono text-[13px] text-brand">
                      Delete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={pendingId !== null}
        title="Delete user"
        body="This user loses console access. Assigned endpoint links are removed."
        confirmLabel="Delete user"
        onClose={() => setPendingId(null)}
        onConfirm={onDelete}
      />
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const className =
    role === "SUPERADMIN"
      ? "bg-brand text-white"
      : role === "ADMIN"
        ? "bg-amber text-white"
        : "bg-line text-ink";
  return <span className={`rounded px-2 py-1 font-mono text-[11px] tracking-wide ${className}`}>{role}</span>;
}
