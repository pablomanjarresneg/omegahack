import Link from "next/link";
import clsx from "clsx";
import { Topbar } from "@/components/topbar";
import { listRecentAudit, type AuditEntry } from "@/lib/queries";
import { formatDateTimeCO } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const OP_TONE: Record<string, string> = {
  INSERT: "bg-brand/10 text-brand border-brand/40",
  UPDATE: "bg-p2/10 text-p2 border-p2/40",
  DELETE: "bg-overdue/10 text-overdue border-overdue/40",
  TRUNCATE: "bg-overdue/10 text-overdue border-overdue/40",
};

export default async function AuditoriaPage() {
  const rows = await listRecentAudit(200);

  return (
    <>
      <Topbar
        title="Auditoría inmutable"
        subtitle={`${rows.length.toLocaleString("es-CO")} evento${rows.length === 1 ? "" : "s"} más reciente${rows.length === 1 ? "" : "s"} · append-only`}
      />
      <main className="flex flex-1 flex-col gap-4 p-6">
        <p className="max-w-3xl text-xs text-fg-muted">
          Cada escritura sobre <code className="rounded bg-bg-subtle px-1 text-[11px]">pqr</code> queda registrada
          por un trigger SECURITY DEFINER. La tabla es append-only: ni
          jurídica ni superadmin pueden modificar una fila. Habeas Data
          exige trazabilidad; aquí está la prueba.
        </p>

        {rows.length === 0 ? (
          <div className="rounded border border-dashed border-border bg-bg-subtle px-6 py-14 text-center">
            <p className="text-sm font-medium">Sin eventos registrados</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-fg-subtle">
              El trigger de auditoría registra cada INSERT / UPDATE / DELETE
              sobre las tablas operativas.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-border bg-surface">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle text-left text-[11px] uppercase tracking-wide text-fg-subtle">
                  <Th className="w-[170px]">Cuando</Th>
                  <Th className="w-[80px]">Op</Th>
                  <Th className="w-[140px]">Tabla</Th>
                  <Th className="w-[200px]">Fila</Th>
                  <Th>Diff</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-border last:border-b-0 hover:bg-surface-hover"
                  >
                    <Td className="tnum text-[11px] text-fg-muted">
                      {formatDateTimeCO(a.created_at)}
                    </Td>
                    <Td>
                      <span
                        className={clsx(
                          "inline-flex rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                          OP_TONE[a.operation] ??
                            "border-border bg-bg-subtle text-fg-muted",
                        )}
                      >
                        {a.operation}
                      </span>
                    </Td>
                    <Td className="text-xs text-fg-muted">{a.table_name}</Td>
                    <Td className="text-xs">
                      {a.table_name === "pqr" ? (
                        <Link
                          href={`/pqr/${a.row_id}`}
                          className="font-mono text-[11px] text-brand hover:underline"
                        >
                          {a.row_id.slice(0, 8)}…
                        </Link>
                      ) : (
                        <span className="font-mono text-[11px] text-fg-muted">
                          {a.row_id.slice(0, 8)}…
                        </span>
                      )}
                    </Td>
                    <Td>
                      <AuditDiff row={a} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}

function AuditDiff({ row }: { row: AuditEntry }) {
  if (row.operation === "INSERT") {
    return (
      <span className="text-[11px] text-fg-subtle">fila creada</span>
    );
  }
  if (row.operation === "DELETE") {
    return <span className="text-[11px] text-overdue">fila borrada</span>;
  }
  const before = (row.before ?? {}) as Record<string, unknown>;
  const after = (row.after ?? {}) as Record<string, unknown>;
  const changes: string[] = [];
  for (const k of Object.keys(after)) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      changes.push(k);
    }
  }
  if (changes.length === 0) {
    return <span className="text-[11px] text-fg-subtle">sin diff visible</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {changes.slice(0, 5).map((k) => (
        <span
          key={k}
          className="rounded border border-border bg-bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-fg-muted"
        >
          {k}
        </span>
      ))}
      {changes.length > 5 ? (
        <span className="text-[10px] text-fg-subtle">
          + {changes.length - 5}
        </span>
      ) : null}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className}`.trim()}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-middle ${className}`.trim()}>{children}</td>;
}
