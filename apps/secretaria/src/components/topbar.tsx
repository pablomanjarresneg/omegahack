export function Topbar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface/80 px-6 backdrop-blur">
      <div>
        <h1 className="text-sm font-semibold leading-none">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-xs text-fg-subtle">{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
}
