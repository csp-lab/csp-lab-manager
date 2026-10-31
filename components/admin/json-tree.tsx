"use client";

export function JsonTree({ value }: { value: unknown }) {
  return (
    <div className="overflow-x-auto rounded bg-terminal p-4 font-mono text-[13px] leading-relaxed text-code">
      <Node value={value} />
    </div>
  );
}

function Node({ value, name }: { value: unknown; name?: string }) {
  if (value === null || typeof value !== "object") {
    return (
      <div>
        {name ? <span className="text-directive">{name}</span> : null}
        {name ? " " : null}
        <span className="text-[#f59e0b]">{JSON.stringify(value)}</span>
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value);

  return (
    <div>
      {name ? <div className="text-directive">{name}</div> : null}
      <div className={name ? "pl-4" : undefined}>
        {entries.map(([key, child]) => (
          <Node key={key} name={key} value={child} />
        ))}
      </div>
    </div>
  );
}
