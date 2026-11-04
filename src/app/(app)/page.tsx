import { ReunionAcciones } from "@/components/app/ReunionAcciones";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Estado } from "@/interface/types";
import { formatCorto, parseEnviados, proximaAccion } from "@/lib/core/sequence";
import { listReuniones } from "@/lib/google/calendar";
import { requireVendedor } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ESTADOS: Record<Estado, { label: string; className: string }> = {
  agendada: { label: "Esperando confirmación", className: "bg-secondary text-primary" },
  confirmada: { label: "Confirmada", className: "bg-primary text-primary-foreground" },
  revisar: { label: "Revisar", className: "bg-amber-100 text-amber-900" },
  liberada: { label: "Liberada", className: "bg-muted text-muted-foreground" },
  cancelada: { label: "Cancelada", className: "bg-muted text-muted-foreground" },
};

const MOTIVOS: Record<string, string> = {
  sin_telefono: "No encontré el teléfono en la descripción del evento. Agrégalo y pulsa Reactivar.",
  reprogramar: "Pidió otro horario. Mueve el evento en Calendar y la secuencia se reinicia.",
  no_entendido: "Respondió dos veces algo fuera de las opciones. Escríbele por WhatsApp.",
  envio_fallido: "Falló un envío de WhatsApp. Revisa la conexión en Ajustes.",
};

const ETAPAS: Record<string, string> = {
  bienvenida: "Bienvenida",
  confirmacion: "Confirmación",
  liberar: "Liberación",
  recordatorio: "Recordatorio",
};

export default async function ReunionesPage() {
  const { email, config } = await requireVendedor();
  const eventos = await listReuniones(email, config.filtroTitulo);
  const ordenados = [...eventos].sort(
    (a, b) =>
      Number(b.extendedProperties?.private?.pf_estado === "revisar") -
      Number(a.extendedProperties?.private?.pf_estado === "revisar"),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Reuniones</h1>
        <p className="text-sm text-muted-foreground">
          Próximos 14 días{config.filtroTitulo ? ` · eventos con «${config.filtroTitulo}» en el título` : ""}.
        </p>
      </div>

      {!config.activo && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="text-sm text-amber-900">
            La secuencia está pausada. Actívala en Ajustes cuando tu WhatsApp esté conectado.
          </CardContent>
        </Card>
      )}

      {ordenados.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No hay reuniones próximas.</p>
      ) : (
        <ul className="space-y-3">
          {ordenados.map((e) => {
            const props = e.extendedProperties?.private ?? {};
            const estado = (props.pf_estado || null) as Estado | null;
            const enviados = parseEnviados(props);
            return (
              <li key={e.id}>
                <Card className={cn(estado === "revisar" && "border-amber-300")}>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{props.pf_nombre || e.summary}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCorto(Date.parse(e.start!.dateTime!))}
                          {props.pf_telefono ? ` · +${props.pf_telefono}` : ""}
                        </p>
                      </div>
                      {estado ? (
                        <Badge className={ESTADOS[estado].className}>{ESTADOS[estado].label}</Badge>
                      ) : (
                        <Badge variant="outline">Nueva</Badge>
                      )}
                    </div>

                    {estado === "revisar" && props.pf_motivo && (
                      <p className="text-sm text-amber-900">{MOTIVOS[props.pf_motivo] ?? props.pf_motivo}</p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-muted-foreground">
                        <p>Próximo: {proximaAccion(e, config)}</p>
                        {enviados.length > 0 && (
                          <p>
                            Enviado:{" "}
                            {enviados
                              .map((x) => ETAPAS[x] ?? x.replace("insistencia_", "Insistencia "))
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                      <ReunionAcciones eventId={e.id} estado={estado} />
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
