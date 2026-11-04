import "server-only";
import type { CalendarEvent, Envio, VendedorConfig } from "@/interface/types";
import { buildNotificacion, handleReply, normalizePhone, planEvent, type Plan } from "@/lib/core/sequence";
import {
  deleteReunion,
  findReunionByPhone,
  getConfig,
  getReunion,
  listReuniones,
  listSellerCalendars,
  patchReunionProps,
} from "@/lib/google/calendar";

interface Vendedor {
  calendarId: string;
  config: VendedorConfig;
}

async function listVendedoresActivos(): Promise<Vendedor[]> {
  const calendars = await listSellerCalendars();
  const vendedores = await Promise.all(
    calendars.map(async (calendarId) => ({ calendarId, config: await getConfig(calendarId) })),
  );
  return vendedores.filter((v): v is Vendedor => !!v.config?.activo && !!v.config.instance);
}

/** Guarda el estado, ejecuta las acciones de Calendar y devuelve los WhatsApp a enviar. */
async function aplicar(v: Vendedor, event: CalendarEvent, plan: Plan): Promise<Envio[]> {
  const props = plan.props ?? event.extendedProperties?.private ?? {};
  const elimina = plan.acciones.some((a) => a.tipo === "eliminar");
  if (plan.props && !elimina) await patchReunionProps(v.calendarId, event.id, plan.props);

  const envios: Envio[] = [];
  const base = { instance: v.config.instance, eventId: event.id, calendarId: v.calendarId };
  for (const accion of plan.acciones) {
    if (accion.tipo === "mensaje" && props.pf_telefono) {
      envios.push({ ...base, numero: props.pf_telefono, texto: accion.texto, mediaUrl: accion.mediaUrl, etapa: accion.etapa });
    } else if (accion.tipo === "eliminar") {
      await deleteReunion(v.calendarId, event.id);
    } else if (accion.tipo === "notificar") {
      const numero = normalizePhone(v.config.whatsappPersonal);
      if (numero) {
        envios.push({
          ...base,
          numero,
          texto: buildNotificacion(event, props, accion.motivo, accion.detalle),
          etapa: `aviso_${accion.motivo}`,
        });
      }
    }
  }
  return envios;
}

export async function runTick(now = Date.now()): Promise<{ envios: Envio[]; errores: string[] }> {
  const envios: Envio[] = [];
  const errores: string[] = [];

  for (const v of await listVendedoresActivos()) {
    try {
      const eventos = await listReuniones(v.calendarId, v.config.filtroTitulo, new Date(now));
      for (const event of eventos) {
        try {
          envios.push(...(await aplicar(v, event, planEvent(event, v.config, now))));
        } catch (error) {
          errores.push(`${v.calendarId}/${event.id}: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      errores.push(`${v.calendarId}: ${(error as Error).message}`);
    }
  }
  return { envios, errores };
}

export async function procesarRespuesta(instance: string, numero: string, texto: string): Promise<Envio[]> {
  const telefono = normalizePhone(numero);
  if (!telefono) return [];

  const v = (await listVendedoresActivos()).find((x) => x.config.instance === instance);
  if (!v) return [];

  const event = await findReunionByPhone(v.calendarId, telefono);
  if (!event) return [];

  return aplicar(v, event, handleReply(event, v.config, texto, Date.now()));
}

/** Un envío falló en N8N: la reunión queda en revisión para que el vendedor la vea. */
export async function registrarFallo(calendarId: string, eventId: string): Promise<void> {
  const event = await getReunion(calendarId, eventId);
  const props = { ...(event.extendedProperties?.private ?? {}) };
  if (!["agendada", "confirmada"].includes(props.pf_estado ?? "")) return;
  await patchReunionProps(calendarId, eventId, { ...props, pf_estado: "revisar", pf_motivo: "envio_fallido" });
}
