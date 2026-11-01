"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { createEndpoint } from "@/lib/actions";
import { createApiKey } from "@/lib/api-key";
import { slugifyAppName } from "@/lib/report-fields";

export function EndpointForm() {
  const router = useRouter();
  const [appName, setAppName] = useState("");
  const [key, setKey] = useState("");
  const [keyLocked, setKeyLocked] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [stamp, setStamp] = useState(0);
  const keyRef = useRef<HTMLInputElement>(null);
  const slug = useMemo(() => slugifyAppName(appName), [appName]);

  function clearFields(nextKey: string) {
    setAppName("");
    setKey(nextKey);
    setKeyLocked(true);
    setError("");
    setStamp((n) => n + 1);
  }

  // Generated after mount so a prerender cannot freeze one key into the page.
  useEffect(() => {
    setKey((current) => current || createApiKey());
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const visible = keyRef.current?.value ?? key;
    if (visible !== key) {
      if (keyRef.current) keyRef.current.value = key;
      setError("The browser replaced the API key. The generated key is restored.");
      toast.error("The browser replaced the API key. Create the endpoint again.");
      return;
    }
    setPending(true);
    setError("");
    const name = appName.trim();
    const result = await createEndpoint({ appName, apiKey: key });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(`Created ${name}`);
    clearFields(createApiKey());
    router.push(`/admin/endpoints/${result.slug}`);
    router.refresh();
  }

  return (
    <form autoComplete="off" onSubmit={onSubmit} className="max-w-xl rounded-md border border-line bg-card p-5">
      <label className="block text-[13px] text-muted">
        App name
        <input
          key={`name-${stamp}`}
          value={appName}
          onChange={(event) => setAppName(event.target.value)}
          autoComplete="off"
          className="mt-1 h-9 w-full rounded border border-line bg-white px-3 text-[15px] outline-none focus:border-terminal"
          required
        />
      </label>
      <p className="mt-2 font-mono text-[13px] text-secondary">Slug: {slug || "—"}</p>
      <label className="mt-4 block text-[13px] text-muted">
        API key
        <span className="mt-1 flex gap-2">
          <input
            ref={keyRef}
            key={`key-${stamp}`}
            name={`api-key-${stamp}`}
            value={key}
            onChange={(event) => setKey(event.target.value)}
            onFocus={() => setKeyLocked(false)}
            autoComplete="new-password"
            autoCorrect="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            readOnly={keyLocked || key.length === 0}
            className="h-9 min-w-0 flex-1 rounded border border-line bg-white px-3 font-mono text-[13px] outline-none focus:border-terminal"
            minLength={16}
            required
          />
          <button
            type="button"
            aria-label="Regenerate API key"
            onClick={() => setKey(createApiKey())}
            className="grid size-9 shrink-0 place-items-center rounded border border-line bg-white text-ink"
          >
            <RefreshCw size={16} />
          </button>
        </span>
      </label>
      {error ? <p className="mt-3 text-[13px] text-brand">{error}</p> : null}
      <button
        type="submit"
        disabled={pending || key.length < 16}
        className="mt-5 rounded bg-terminal px-4 py-2 font-mono text-[13px] text-white disabled:opacity-50"
      >
        Create endpoint
      </button>
    </form>
  );
}
