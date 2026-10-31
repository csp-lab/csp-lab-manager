"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createUser } from "@/lib/actions";
import { canAssignAdminRole, type Role } from "@/lib/rbac";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function UserForm({ actorRole }: { actorRole: Role }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [role, setRole] = useState<Role>("VIEWER");
  const allowAdmin = canAssignAdminRole(actorRole);

  function clearFields() {
    formRef.current?.reset();
    setRole("VIEWER");
  }

  useEffect(() => {
    clearFields();
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const username = String(form.get("username") ?? "").trim();
    const result = await createUser({
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      username,
      password: String(form.get("password") ?? ""),
      role: allowAdmin ? role : "VIEWER",
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(`Created ${username}`);
    clearFields();
    router.push("/admin/users");
    router.refresh();
  }

  return (
    <form ref={formRef} autoComplete="off" onSubmit={onSubmit} className="grid max-w-xl gap-4 rounded-md border border-line bg-card p-5">
      <Field name="firstName" label="First name" />
      <Field name="lastName" label="Last name" />
      <Field name="username" label="Username" />
      <Field name="password" label="Password" type="password" />
      {allowAdmin ? (
        <div className="text-[13px] text-muted">
          Role
          <Select value={role} onValueChange={(next) => setRole(next as Role)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VIEWER">VIEWER</SelectItem>
              <SelectItem value="ADMIN">ADMIN</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="font-mono text-[11px] tracking-wide text-muted">Role: VIEWER</p>
      )}
      {error ? <p className="text-[13px] text-brand">{error}</p> : null}
      <button type="submit" disabled={pending} className="w-fit rounded bg-terminal px-4 py-2 font-mono text-[13px] text-white disabled:opacity-50">
        Create user
      </button>
    </form>
  );
}

function Field({ name, label, type = "text" }: { name: string; label: string; type?: string }) {
  return (
    <label className="text-[13px] text-muted">
      {label}
      <input name={name} type={type} required className="mt-1 h-9 w-full rounded border border-line bg-white px-3 text-[15px] outline-none focus:border-terminal" />
    </label>
  );
}
