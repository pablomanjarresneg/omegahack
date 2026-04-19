import clsx from "clsx";

export function BarList({
  items,
  total,
  barClassName = "bg-brand/70",
  emptyLabel = "Sin datos",
}: {
  items: Array<{ key: string; label: string; count: number; note?: string }>;
  total?: number;
  barClassName?: string;
  emptyLabel?: string;
}) {
  const denom = total ?? items.reduce((s, i) => s + i.count, 0);
  if (!items.length) {
    return <p className="py-4 text-xs text-fg-subtle">{emptyLabel}</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => {
        const pct = denom > 0 ? (item.count / denom) * 100 : 0;
        return (
          <li key={item.key} className="group">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-fg">{item.label}</span>
              <span className="shrink-0 tnum text-fg-subtle">
                <span className="font-medium text-fg">{item.count}</span>
                {item.note ? (
                  <span className="ml-1">· {item.note}</span>
                ) : null}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-subtle">
              <div
                className={clsx("h-full rounded-full transition-[width]", barClassName)}
                style={{ width: `${Math.max(pct, 2)}%` }}
                role="progressbar"
                aria-valuenow={item.count}
                aria-valuemin={0}
                aria-valuemax={denom}
                aria-label={`${item.label}: ${item.count}`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
