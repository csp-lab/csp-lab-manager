"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Calendar, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { deleteReport, queryReports } from "@/lib/actions";
import { formatReportTime, reportBoundIso, resolveReportTime, toDatetimeLocal } from "@/lib/report-fields";
import { DEFAULT_REPORT_LIMIT, MAX_REPORT_LIMIT, MIN_REPORT_LIMIT } from "@/lib/validations/forms";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { JsonTree } from "@/components/admin/json-tree";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const INTERVALS = [
  { label: "Off", ms: 0 },
  { label: "5s", ms: 5_000 },
  { label: "10s", ms: 10_000 },
  { label: "30s", ms: 30_000 },
  { label: "1m", ms: 60_000 },
  { label: "5m", ms: 5 * 60_000 },
  { label: "15m", ms: 15 * 60_000 },
  { label: "30m", ms: 30 * 60_000 },
  { label: "1h", ms: 60 * 60_000 },
];

const RANGES = [
  ["15m", "now-15m"],
  ["1h", "now-1h"],
  ["24h", "now-24h"],
  ["7d", "now-7d"],
] as const;

type ReportRow = {
  id: string;
  blockedUri: string;
  violatedDirective: string;
  disposition: string;
  createdAt: string;
  rawJson: unknown;
};

type Payload = {
  reports: ReportRow[];
  directives: string[];
  domains: string[];
  capped: boolean;
};

export function ReportExplorer({
  slug,
  canDelete = false,
  initial,
  initialFrom,
  initialTo,
}: {
  slug: string;
  canDelete?: boolean;
  initial: Payload;
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [refreshLabel, setRefreshLabel] = useState("Off");
  const intervalMs = INTERVALS.find((item) => item.label === refreshLabel)?.ms ?? 0;
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const appliedRef = useRef({ from: initialFrom.trim(), to: initialTo.trim() });
  const nextFrom = from.trim();
  const nextTo = to.trim();
  if (
    isReportTimeInput(from) &&
    isReportTimeInput(to) &&
    (nextFrom !== appliedRef.current.from || nextTo !== appliedRef.current.to)
  ) {
    appliedRef.current = { from: nextFrom, to: nextTo };
  }
  const applied = appliedRef.current;
  const [directive, setDirective] = useState("");
  const [domain, setDomain] = useState("");
  const [disposition, setDisposition] = useState("");
  const [unique, setUnique] = useState(false);
  const [sort, setSort] = useState<"newest" | "oldest" | "domain">("newest");
  const [limit, setLimit] = useState(DEFAULT_REPORT_LIMIT);
  const [limitInput, setLimitInput] = useState(String(DEFAULT_REPORT_LIMIT));

  function applyLimit(value: string) {
    const next = Number(value);
    if (!Number.isInteger(next) || next < MIN_REPORT_LIMIT || next > MAX_REPORT_LIMIT) return false;
    setLimit(next);
    return true;
  }

  function commitLimit() {
    if (!applyLimit(limitInput)) setLimitInput(String(limit));
  }

  const filters = {
    slug,
    from: applied.from,
    to: applied.to,
    directive: directive || undefined,
    domain: domain || undefined,
    disposition: disposition === "enforce" || disposition === "report" ? disposition : undefined,
    unique,
    sort,
    limit,
  };
  const isDefault =
    applied.from === initialFrom.trim() &&
    applied.to === initialTo.trim() &&
    !directive &&
    !domain &&
    !disposition &&
    !unique &&
    sort === "newest" &&
    limit === DEFAULT_REPORT_LIMIT;

  const query = useQuery({
    queryKey: ["reports", filters],
    queryFn: async ({ queryKey }) => {
      const key = queryKey[1] as typeof filters;
      const now = new Date();
      const result = await queryReports({
        ...key,
        from: reportBoundIso(key.from, now),
        to: reportBoundIso(key.to, now),
      });
      if (!result.ok) throw new Error(result.error);
      return {
        reports: result.data.reports,
        directives: result.data.directives,
        domains: result.data.domains,
        capped: result.data.capped,
      } satisfies Payload;
    },
    initialData: isDefault ? initial : undefined,
    refetchInterval: intervalMs || false,
  });

  const data = query.data ?? initial;

  async function removeReport() {
    if (!pendingId) return;
    setRemoving(true);
    const result = await deleteReport(slug, pendingId, unique);
    setRemoving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPendingId(null);
    toast.success(unique ? "Removed group" : "Removed report");
    await query.refetch();
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-panel p-4">
        <div className="flex items-end gap-3">
          <div className="text-[13px] text-muted">
            Refresh
            <Select value={refreshLabel} onValueChange={setRefreshLabel}>
              <SelectTrigger className="mt-1 w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVALS.map((item) => (
                  <SelectItem key={item.label} value={item.label}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="inline-flex h-9 items-center gap-2 rounded border border-line bg-card px-3 font-mono text-[13px]"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          {intervalMs > 0 ? (
            <span className="inline-flex h-9 items-center gap-2 font-mono text-[11px] leading-none tracking-wide text-muted">
              <span className="live-dot" />
              Live
            </span>
          ) : null}
        </div>
        <TimeField label="From" value={from} onChange={setFrom} placeholder="now-15m" />
        <TimeField label="To" value={to} onChange={setTo} placeholder="now" />
        <div className="flex flex-wrap gap-2">
          {RANGES.map(([label, fromExpr]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setFrom(fromExpr);
                setTo("now");
              }}
              className="h-9 rounded border border-line bg-card px-3 font-mono text-[11px] tracking-wide"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Filter label="Directive" value={directive} onChange={setDirective} options={data.directives} />
        <Filter label="Blocked domain" value={domain} onChange={setDomain} options={data.domains} />
        <Filter
          label="Disposition"
          value={disposition}
          onChange={setDisposition}
          options={["enforce", "report"]}
        />
        <label
          className="text-[13px] text-muted"
          title="One row per document, directive, blocked URI, and disposition"
        >
          Show
          <span className="mt-1 flex h-9 items-center gap-2 rounded border border-line bg-white px-2">
            <input
              type="checkbox"
              className="size-4 accent-terminal"
              checked={unique}
              onChange={(event) => setUnique(event.target.checked)}
            />
            Unique only
          </span>
        </label>
        <div className="text-[13px] text-muted">
          Sort
          <Select value={sort} onValueChange={(value) => setSort(value as "newest" | "oldest" | "domain")}>
            <SelectTrigger className="mt-1 w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="domain">Domain A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="text-[13px] text-muted">
          Limit
          <input
            type="number"
            min={MIN_REPORT_LIMIT}
            max={MAX_REPORT_LIMIT}
            inputMode="numeric"
            value={limitInput}
            onChange={(event) => {
              const value = event.target.value;
              setLimitInput(value);
              applyLimit(value);
            }}
            onBlur={commitLimit}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="mt-1 block h-9 w-24 rounded border border-line bg-white px-2 font-mono text-[13px]"
          />
        </label>
      </div>

      {query.isError ? <p className="text-[13px] text-brand">{(query.error as Error).message}</p> : null}
      {data.capped ? (
        <p className="font-mono text-[11px] tracking-wide text-muted">
          Showing {limit} {unique ? "unique " : ""}reports for this filter.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        {data.reports.length === 0 ? (
          <p className="rounded-md border border-dashed border-line bg-card p-5 text-[15px] text-secondary">
            No reports in this range.
          </p>
        ) : (
          data.reports.map((report) => (
            <details key={report.id} className="group rounded-md border border-line bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <svg viewBox="0 0 12 12" aria-hidden className="size-3 shrink-0 fill-muted transition-transform group-open:rotate-90">
                  <path d="M4 2.2 9 6 4 9.8z" />
                </svg>
                <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{report.blockedUri || "(empty)"}</span>
                <span className="rounded bg-amber px-2 py-1 font-mono text-[11px] tracking-wide text-white">
                  {report.violatedDirective}
                </span>
                <span className="rounded border border-line px-2 py-1 font-mono text-[11px] tracking-wide text-secondary">
                  {report.disposition}
                </span>
                <time className="font-mono text-[11px] tracking-wide text-muted">
                  {formatReportTime(report.createdAt)}
                </time>
                {canDelete ? (
                  <button
                    type="button"
                    className="shrink-0 font-mono text-[13px] text-brand"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setPendingId(report.id);
                    }}
                  >
                    {unique ? "Remove group" : "Remove"}
                  </button>
                ) : null}
              </summary>
              <div className="border-t border-line p-3">
                <JsonTree value={report.rawJson} />
              </div>
            </details>
          ))
        )}
      </div>
      <ConfirmDialog
        open={pendingId !== null}
        title={unique ? "Remove group" : "Remove report"}
        body={
          unique
            ? "Every report with this document, directive, blocked URI, and disposition will be deleted."
            : "This report will be deleted."
        }
        confirmLabel={unique ? "Remove group" : "Remove report"}
        pending={removing}
        onClose={() => setPendingId(null)}
        onConfirm={removeReport}
      />
    </section>
  );
}

function isReportTimeInput(value: string) {
  const text = value.trim();
  return text === "" || resolveReportTime(text) !== null;
}

function TimeField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const invalid = value.trim() !== "" && resolveReportTime(value) === null;
  return (
    <div className="text-[13px] text-muted">
      {label}
      <div className="mt-1 flex">
        <input
          type="text"
          value={value}
          spellCheck={false}
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
          className={`h-9 w-44 rounded-l border bg-white px-2 font-mono text-[13px] ${invalid ? "border-brand" : "border-line"}`}
        />
        <div className="relative -ml-px h-9 w-9 shrink-0">
          <span className="pointer-events-none flex h-full w-full items-center justify-center rounded-r border border-line bg-card text-secondary">
            <Calendar size={14} />
          </span>
          <input
            type="datetime-local"
            aria-label={`Pick ${label.toLowerCase()} date and time`}
            onPointerDown={(event) => {
              event.currentTarget.value = toDatetimeLocal(resolveReportTime(value.trim()) ?? new Date());
            }}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 h-full w-full min-w-0 cursor-pointer opacity-0"
          />
        </div>
      </div>
    </div>
  );
}

const ALL = "__all__";

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  const choices = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <div className="text-[13px] text-muted">
      {label}
      <Select value={value || ALL} onValueChange={(next) => onChange(next === ALL ? "" : next)}>
        <SelectTrigger className="mt-1 w-auto max-w-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {choices.filter((option) => option && option !== ALL).map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

