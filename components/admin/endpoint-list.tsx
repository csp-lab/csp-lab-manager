"use client";

import { useState } from "react";
import Link from "next/link";
import { formatReportCount } from "@/lib/report-fields";

type EndpointCard = {
  id: string;
  appName: string;
  appNameSlug: string;
  reportCount: number;
  live: boolean;
};

type SortKey = "name" | "reports";
type Direction = "asc" | "desc";

function reportLabel(count: number) {
  const shown = formatReportCount(count);
  if (count === 1) return "1 report";
  return `${shown} reports`;
}

function byName(a: EndpointCard, b: EndpointCard) {
  return a.appName.localeCompare(b.appName, undefined, { numeric: true, sensitivity: "base" });
}

export function EndpointList({ endpoints }: { endpoints: EndpointCard[] }) {
  const [sort, setSort] = useState<SortKey>("name");
  const [direction, setDirection] = useState<Direction>("asc");

  if (endpoints.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line bg-card p-5 text-[15px] text-secondary">
        No endpoints yet.
      </p>
    );
  }

  function choose(key: SortKey) {
    if (sort === key) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSort(key);
    setDirection(key === "name" ? "asc" : "desc");
  }

  const sign = direction === "asc" ? 1 : -1;
  const rows = [...endpoints].sort((a, b) => {
    const primary = sort === "name" ? byName(a, b) : a.reportCount - b.reportCount;
    if (primary !== 0) return primary * sign;
    return byName(a, b);
  });

  const nameLabel = sort === "name" ? (direction === "asc" ? "Name A-Z" : "Name Z-A") : "Name";
  const reportsLabel = sort === "reports" ? (direction === "desc" ? "Most reports" : "Fewest reports") : "Reports";

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit rounded border border-line bg-card p-0.5" role="group" aria-label="Sort endpoints">
        <SortButton active={sort === "name"} label={nameLabel} onClick={() => choose("name")} />
        <SortButton active={sort === "reports"} label={reportsLabel} onClick={() => choose("reports")} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((endpoint) => (
          <Link
            key={endpoint.id}
            href={`/admin/endpoints/${endpoint.appNameSlug}`}
            className="rounded-md border border-line bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:border-terminal"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold">{endpoint.appName}</h2>
                <p className="mt-1 font-mono text-[13px] text-muted">{endpoint.appNameSlug}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-2 rounded bg-amber px-2 py-1 font-mono text-[11px] tracking-wide text-white">
                {endpoint.live ? <span className="live-dot" /> : null}
                {reportLabel(endpoint.reportCount)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SortButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? "rounded bg-terminal px-3 py-1.5 font-mono text-[11px] tracking-wide text-white"
          : "rounded px-3 py-1.5 font-mono text-[11px] tracking-wide text-secondary"
      }
    >
      {label}
    </button>
  );
}
