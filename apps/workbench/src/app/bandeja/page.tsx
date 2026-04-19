import { Topbar } from "@/components/topbar";
import { BandejaBoard } from "@/components/bandeja-board";
import { listActiveQueue, listComunas, listSecretarias, type QueuePqr } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BandejaPage() {
  const { rows, secretarias, comunas } = await getBandejaData();

  const secretariaById = new Map(secretarias.map((item) => [item.id, item]));
  const comunaById = new Map(comunas.map((item) => [item.id, item]));

  const hydratedRows = rows.map((row) => {
    const comuna = row.comuna_id ? comunaById.get(row.comuna_id) : null;
    return {
      ...row,
      secretariaName: row.secretaria_id
        ? (secretariaById.get(row.secretaria_id)?.nombre ?? null)
        : null,
      comunaLabel: comuna
        ? comuna.numero < 100
          ? `Comuna ${comuna.numero}`
          : comuna.nombre
        : null,
    };
  });

  const total = rows.length;

  return (
    <>
      <Topbar
        title="Bandeja del dia"
        subtitle={
          total === 0
            ? "Todo al dia."
            : `${total.toLocaleString("es-CO")} PQR${total === 1 ? "" : "s"} activa${total === 1 ? "" : "s"} - priorizacion automatica`
        }
      />

      <main className="flex flex-1 flex-col gap-6 p-6">
        <BandejaBoard
          initialRows={hydratedRows}
          secretarias={secretarias.map((item) => ({
            id: item.id,
            label: item.nombre,
          }))}
          comunas={comunas.map((item) => ({
            id: item.id,
            label:
              item.numero < 100 ? `Comuna ${item.numero} - ${item.nombre}` : item.nombre,
          }))}
        />
      </main>
    </>
  );
}

async function getBandejaData(): Promise<{
  rows: QueuePqr[];
  secretarias: Array<{ id: string; nombre: string }>;
  comunas: Array<{ id: string; nombre: string; numero: number }>;
}> {
  try {
    const [rows, secretarias, comunas] = await Promise.all([
      listActiveQueue(300),
      listSecretarias(),
      listComunas(),
    ]);
    return { rows, secretarias, comunas };
  } catch {
    return {
      rows: localFallbackRows(),
      secretarias: [
        { id: "sec-1", nombre: "Secretaria de Salud" },
        { id: "sec-2", nombre: "Secretaria de Movilidad" },
        { id: "sec-3", nombre: "Secretaria de Educacion" },
      ],
      comunas: [
        { id: "com-1", nombre: "Centro", numero: 1 },
        { id: "com-5", nombre: "Nororiental", numero: 5 },
        { id: "com-11", nombre: "Occidental", numero: 11 },
      ],
    };
  }
}

function localFallbackRows(): QueuePqr[] {
  return [
    {
      id: "11111111-1111-1111-1111-111111111111",
      radicado: "RAD-2026-0001",
      status: "received",
      channel: "web",
      tipo: "peticion",
      priority_level: "P0_critica",
      priority_score: 95,
      lead: "Solicitud de medicamento prioritario para paciente cronico",
      display_text:
        "Ciudadano reporta demora en entrega de medicamento de alto costo. Solicita priorizacion inmediata por riesgo de interrupcion de tratamiento.",
      issued_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      legal_deadline: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      secretaria_id: "sec-1",
      comuna_id: "com-1",
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      radicado: "RAD-2026-0002",
      status: "received",
      channel: "email",
      tipo: "queja",
      priority_level: "P1_alta",
      priority_score: 84,
      lead: "Queja por demoras en semaforizacion de corredor vial",
      display_text:
        "Reporte ciudadano sobre congestion severa por falla intermitente de semaforos en hora pico. Solicita accion correctiva y plan de contingencia.",
      issued_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
      legal_deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      secretaria_id: "sec-2",
      comuna_id: "com-11",
    },
    {
      id: "33333333-3333-3333-3333-333333333333",
      radicado: "RAD-2026-0003",
      status: "accepted",
      channel: "verbal",
      tipo: "reclamo",
      priority_level: "P2_media",
      priority_score: 63,
      lead: "Reclamo por cupo escolar no asignado",
      display_text:
        "Solicitante informa que no obtuvo asignacion en institucion cercana pese a cumplir requisitos. Pide revision y respuesta formal.",
      issued_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
      legal_deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      secretaria_id: "sec-3",
      comuna_id: "com-5",
    },
    {
      id: "44444444-4444-4444-4444-444444444444",
      radicado: "RAD-2026-0004",
      status: "assigned",
      channel: "web",
      tipo: "peticion",
      priority_level: "P1_alta",
      priority_score: 76,
      lead: "Peticion de certificacion laboral historica",
      display_text:
        "El ciudadano solicita expedicion de certificacion con vigencias 2017 a 2020 para proceso de pension.",
      issued_at: new Date(Date.now() - 42 * 60 * 60 * 1000).toISOString(),
      legal_deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      secretaria_id: "sec-1",
      comuna_id: "com-1",
    },
    {
      id: "55555555-5555-5555-5555-555555555555",
      radicado: "RAD-2026-0005",
      status: "in_review",
      channel: "email",
      tipo: "peticion",
      priority_level: "P2_media",
      priority_score: 57,
      lead: "Solicitud de estado de tramite urbanistico",
      display_text:
        "Peticionario requiere trazabilidad del expediente urbanistico y fechas comprometidas para decision de fondo.",
      issued_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      legal_deadline: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      secretaria_id: "sec-2",
      comuna_id: "com-11",
    },
    {
      id: "66666666-6666-6666-6666-666666666666",
      radicado: "RAD-2026-0006",
      status: "approved",
      channel: "web",
      tipo: "reclamo",
      priority_level: "P3_baja",
      priority_score: 30,
      lead: "Reclamo por inconsistencia en liquidacion",
      display_text:
        "Se aprueba respuesta para envio por canal web. Incluye aclaracion de formula de cobro y valores corregidos.",
      issued_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      legal_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      secretaria_id: "sec-3",
      comuna_id: "com-5",
    },
  ];
}
