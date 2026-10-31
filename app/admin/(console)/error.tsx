"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-md border border-line bg-card p-5">
      <p className="text-[15px] text-brand">{error.message || "Something went wrong."}</p>
      <button type="button" onClick={reset} className="mt-4 rounded bg-terminal px-4 py-2 font-mono text-[13px] text-white">
        Retry
      </button>
    </div>
  );
}
