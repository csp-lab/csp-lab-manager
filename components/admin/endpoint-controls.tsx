"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { clearReports, deleteEndpoint, regenerateApiKey, setEndpointAccess } from "@/lib/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { canManageEndpoints, type Role } from "@/lib/rbac";
import { cn } from "@/lib/utils";

type Person = { id: string; username: string; firstName: string; lastName: string; role: Role };

export function EndpointMembers({
  slug,
  users,
  assignedUserIds,
}: {
  slug: string;
  users: Person[];
  assignedUserIds: string[];
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(assignedUserIds);
  const [error, setError] = useState("");

  function discard() {
    setSelected(assignedUserIds);
    setError("");
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) discard();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") discard();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, assignedUserIds]);

  async function saveAccess() {
    setError("");
    const ids = users
      .filter((person) => canManageEndpoints(person.role) || selected.includes(person.id))
      .map((person) => person.id);
    const result = await setEndpointAccess(slug, ids);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Updated members");
    setOpen(false);
    router.refresh();
  }

  const people = [...users].sort(
    (a, b) => Number(canManageEndpoints(b.role)) - Number(canManageEndpoints(a.role)),
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Endpoint members"
        aria-expanded={open}
        onClick={() => {
          if (open) discard();
          else setOpen(true);
        }}
        className={cn(
          "grid size-9 place-items-center rounded border bg-card text-ink",
          open ? "border-terminal" : "border-line",
        )}
      >
        <UserPlus size={16} />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Endpoint members"
          className="absolute right-0 z-20 mt-2 w-80 rounded-md border border-line bg-card p-3 shadow-[0_8px_24px_rgba(10,28,39,0.12)]"
        >
          <p className="font-mono text-[11px] tracking-wide text-muted">Members</p>
          <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-auto">
            {people.map((person) => {
              const fixed = canManageEndpoints(person.role);
              return (
                <li key={person.id}>
                  <label
                    className={cn(
                      "flex items-center gap-2 rounded px-1 py-1.5 text-[15px]",
                      fixed ? "cursor-default" : "cursor-pointer",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-terminal"
                      checked={fixed || selected.includes(person.id)}
                      disabled={fixed}
                      onChange={(event) => {
                        if (fixed) return;
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, person.id]
                            : current.filter((id) => id !== person.id),
                        );
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {person.firstName} {person.lastName}
                      <span className="ml-2 font-mono text-[11px] text-muted">{person.username}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted">{person.role}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {error ? <p className="mt-2 text-[13px] text-brand">{error}</p> : null}
          <button
            type="button"
            onClick={saveAccess}
            className="mt-3 rounded bg-terminal px-4 py-2 font-mono text-[13px] text-white"
          >
            Save access
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function EndpointControls({
  slug,
  apiKey,
  origin,
}: {
  slug: string;
  apiKey: string | null;
  origin: string;
}) {
  const router = useRouter();
  const [key, setKey] = useState(apiKey);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"clear" | "delete" | null>(null);
  const [pending, setPending] = useState(false);

  if (!key) return null;

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(`${origin}/endpoint/${slug}?apiKey=${key}`);
      toast.success("Copied report URL");
    } catch {
      toast.error("Could not copy the report URL");
    }
  }

  async function rotate() {
    setError("");
    const result = await regenerateApiKey(slug);
    if (!result.ok || !result.apiKey) {
      const message = result.ok ? "No key returned" : result.error;
      setError(message);
      toast.error(message);
      return;
    }
    setKey(result.apiKey);
    toast.success("Regenerated API key");
  }

  async function confirmDanger() {
    setPending(true);
    const deleting = mode === "delete";
    const result = deleting ? await deleteEndpoint(slug, slug) : await clearReports(slug, slug);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(deleting ? `Deleted ${slug}` : `Cleared reports for ${slug}`);
    setMode(null);
    if (deleting) router.push("/admin/endpoints");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-md bg-terminal p-5 text-code">
        <p className="font-mono text-[11px] tracking-wide text-directive">report-uri</p>
        <p className="mt-2 break-all font-mono text-[13px]">
          {origin}/endpoint/{slug}?apiKey={key}
        </p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={copyKey} className="rounded bg-white/10 px-3 py-2 font-mono text-[13px]">
            Copy URL
          </button>
          <button type="button" onClick={rotate} className="rounded bg-white/10 px-3 py-2 font-mono text-[13px]">
            Regenerate key
          </button>
        </div>
      </section>

      <section className="rounded-md border border-brand/40 bg-card p-5">
        <h2 className="text-[16px] font-semibold text-brand">Danger zone</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode("clear")} className="rounded border border-brand px-4 py-2 font-mono text-[13px] text-brand">
            Clear all reports
          </button>
          <button type="button" onClick={() => setMode("delete")} className="rounded bg-brand px-4 py-2 font-mono text-[13px] text-white">
            Delete endpoint
          </button>
        </div>
      </section>
      {error ? <p className="text-[13px] text-brand">{error}</p> : null}
      <ConfirmDialog
        open={mode !== null}
        title={mode === "delete" ? "Delete endpoint" : "Clear all reports"}
        body={
          mode === "delete"
            ? "This endpoint and every report it holds will be deleted."
            : "All report data for this endpoint will be lost forever."
        }
        confirmLabel={mode === "delete" ? "Delete endpoint" : "Clear reports"}
        typed={slug}
        pending={pending}
        onClose={() => setMode(null)}
        onConfirm={confirmDanger}
      />
    </div>
  );
}
