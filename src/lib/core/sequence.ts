/**
 * Lógica pura de la secuencia: sin I/O, para que el motor y la UI compartan
 * exactamente las mismas reglas.
 */
import type { CalendarEvent, Estado, Motivo, VendedorConfig } from "@/interface/types";
import { OPCIONES_TXT } from "./config";

const HORA = 3600_000;
const MINUTO = 60_000;
const TZ = "America/Bogota";

export type Accion =
  | { tipo: "mensaje"; etapa: string; texto: string; mediaUrl?: string }
  | { tipo: "notificar"; motivo: Motivo; detalle?: string }
  | { tipo: "eliminar" };

export interface Plan {
  /** Mapa completo de propiedades privadas a guardar, o null si no cambió. */
  props: Record<string, string> | null;
  acciones: Accion[];
}

const SIN_CAMBIOS: Plan = { props: null, acciones: [] };

// ---------- Utilidades ----------

export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return "";
}

export function extractContact(event: CalendarEvent): { telefono: string; nombre: string } {
  const description = (event.description ?? "").replace(/<[^>]+>/g, "\n");

  let telefono = "";
  for (const match of description.match(/\+?\d[\d\s().-]{8,}\d/g) ?? []) {
    telefono = normalizePhone(match);
    if (telefono) break;
  }

  let nombre = description.match(/(?:nombre|name)\s*:\s*([^\n]+)/i)?.[1]?.trim() ?? "";
  if (!nombre) {
    const invitado = event.attendees?.find((a) => !a.self && !a.organizer);
    nombre = invitado?.displayName ?? invitado?.email?.split("@")[0] ?? "";
  }
  return { telefono, nombre };
}

/** Interpreta una respuesta del prospecto. Coincidencia exacta tras normalizar. */
export function normalizeReply(texto: string): "1" | "2" | "3" | null {
  const t = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[️⃣]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (["1", "si", "confirmo", "confirmado", "ok"].includes(t)) return "1";
  if (["2", "reprogramar", "otro horario"].includes(t)) return "2";
  if (["3", "cancelar", "no puedo"].includes(t)) return "3";
  return null;
}

export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

export function formatFecha(ms: number): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(ms);
}

export function formatHora(ms: number): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(ms);
}

export function formatCorto(ms: number): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(ms);
}

export function meetingLink(event: CalendarEvent): string {
  const video = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video");
  return event.hangoutLink ?? video?.uri ?? event.location ?? "";
}

export function parseEnviados(props: Record<string, string>): string[] {
  return (props.pf_enviados ?? "").split(",").filter(Boolean);
}

function vars(event: CalendarEvent, props: Record<string, string>, config: VendedorConfig) {
  const inicio = Date.parse(event.start?.dateTime ?? "");
  return {
    nombre: (props.pf_nombre ?? "").split(" ")[0],
    fecha: formatFecha(inicio),
    hora: formatHora(inicio),
    link: meetingLink(event),
    vendedor: config.nombre,
  };
}

const MOTIVOS: Record<Motivo, string> = {
  sin_telefono: "No encontré el teléfono del prospecto en el evento. Agrégalo en la descripción del evento.",
  reprogramar: "Pidió otro horario. Mueve el evento en Calendar y la secuencia se reinicia sola.",
  no_entendido: "Respondió dos veces algo que no corresponde a las opciones. Escríbele tú.",
  cancelada: "Canceló la reunión. Eliminé el evento.",
  liberada: "No confirmó a tiempo. Liberé el cupo y eliminé el evento.",
  envio_fallido: "Falló el envío de un mensaje de WhatsApp. Revisa la conexión de tu número.",
};

export function buildNotificacion(
  event: CalendarEvent,
  props: Record<string, string>,
  motivo: Motivo,
  detalle?: string,
): string {
  const inicio = Date.parse(event.start?.dateTime ?? "");
  const lineas = [
    "🔔 *Prospección*",
    MOTIVOS[motivo],
    "",
    `Prospecto: ${props.pf_nombre || "(sin nombre)"}${props.pf_telefono ? ` · +${props.pf_telefono}` : ""}`,
    `Reunión: ${event.summary ?? ""} · ${formatCorto(inicio)}`,
  ];
  if (detalle) lineas.push(`Mensaje recibido: "${detalle}"`);
  return lineas.join("\n");
}

// ---------- Motor ----------

function cerrar(
  props: Record<string, string>,
  estado: Estado,
  motivo: Motivo,
  mensaje: Accion,
): Accion[] {
  props.pf_estado = estado;
  props.pf_motivo = motivo;
  return [mensaje, { tipo: "eliminar" }, { tipo: "notificar", motivo }];
}

/** Decide qué etapas tocan ahora para una reunión. */
export function planEvent(event: CalendarEvent, config: VendedorConfig, now: number): Plan {
  const inicioIso = event.start?.dateTime;
  const original = event.extendedProperties?.private ?? {};
  if (!inicioIso || original.pf_tipo === "config") return SIN_CAMBIOS;

  const props = { ...original };
  const inicio = Date.parse(inicioIso);
  const liberarAt = inicio - config.liberarHoras * HORA;
  const estadoInicial = (): Estado => (now >= liberarAt ? "confirmada" : "agendada");
  const acciones: Accion[] = [];
  let changed = false;

  if (!props.pf_estado) {
    const { telefono, nombre } = extractContact(event);
    Object.assign(props, {
      pf_telefono: telefono,
      pf_nombre: nombre,
      pf_inicio_ref: inicioIso,
      pf_enviados: "",
      pf_conf_enviada_en: "",
      pf_no_entendido: "0",
      pf_motivo: "",
    });
    if (!telefono) {
      props.pf_estado = "revisar";
      props.pf_motivo = "sin_telefono";
      return { props, acciones: [{ tipo: "notificar", motivo: "sin_telefono" }] };
    }
    props.pf_estado = estadoInicial();
    changed = true;
  } else if (
    Date.parse(props.pf_inicio_ref ?? "") !== inicio &&
    ["agendada", "confirmada", "revisar"].includes(props.pf_estado)
  ) {
    // Reprogramada: se reinicia todo menos la bienvenida.
    const enviados = parseEnviados(props).filter((e) => e === "bienvenida");
    Object.assign(props, {
      pf_inicio_ref: inicioIso,
      pf_enviados: enviados.join(","),
      pf_conf_enviada_en: "",
      pf_no_entendido: "0",
      pf_motivo: "",
      pf_forzar: "",
      pf_estado: props.pf_telefono ? estadoInicial() : "revisar",
    });
    changed = true;
  }

  const v = vars(event, props, config);
  const enviados = new Set(parseEnviados(props));
  const marcar = (etapa: string) => {
    enviados.add(etapa);
    changed = true;
  };
  const conOpciones = (tpl: string) => `${renderTemplate(tpl, v)}\n\n${OPCIONES_TXT}`;

  // Liberación manual pedida desde la UI.
  if (props.pf_forzar === "liberar" && ["agendada", "confirmada", "revisar"].includes(props.pf_estado)) {
    props.pf_forzar = "";
    marcar("liberar");
    acciones.push(
      ...cerrar(props, "liberada", "liberada", {
        tipo: "mensaje",
        etapa: "liberar",
        texto: renderTemplate(config.txtLiberado, v),
      }),
    );
    props.pf_enviados = [...enviados].join(",");
    return { props, acciones };
  }

  const estado = props.pf_estado as Estado;
  if (estado !== "agendada" && estado !== "confirmada") {
    return changed ? { props, acciones } : SIN_CAMBIOS;
  }

  if (!enviados.has("bienvenida")) {
    marcar("bienvenida");
    acciones.push({
      tipo: "mensaje",
      etapa: "bienvenida",
      texto: renderTemplate(config.txtBienvenida, v),
      mediaUrl: config.videoUrl || undefined,
    });
  }

  if (estado === "agendada") {
    if (now >= liberarAt) {
      marcar("liberar");
      acciones.push(
        ...cerrar(props, "liberada", "liberada", {
          tipo: "mensaje",
          etapa: "liberar",
          texto: renderTemplate(config.txtLiberado, v),
        }),
      );
    } else if (!enviados.has("confirmacion")) {
      if (now >= inicio - config.confHoras * HORA) {
        marcar("confirmacion");
        props.pf_conf_enviada_en = new Date(now).toISOString();
        acciones.push({ tipo: "mensaje", etapa: "confirmacion", texto: conOpciones(config.txtConfirmacion) });
      }
    } else if (props.pf_conf_enviada_en) {
      const conf = Date.parse(props.pf_conf_enviada_en);
      let due = 0;
      for (let k = 1; k <= config.insistVeces; k++) {
        const at = conf + k * config.insistCadaHoras * HORA;
        if (now >= at && at < liberarAt) due = k;
      }
      if (due > 0 && !enviados.has(`insistencia_${due}`)) {
        for (let k = 1; k <= due; k++) marcar(`insistencia_${k}`);
        acciones.push({ tipo: "mensaje", etapa: `insistencia_${due}`, texto: conOpciones(config.txtInsistencia) });
      }
    }
  }

  if (
    props.pf_estado === "confirmada" &&
    !enviados.has("recordatorio") &&
    now >= inicio - config.recordMin * MINUTO &&
    now < inicio
  ) {
    marcar("recordatorio");
    acciones.push({ tipo: "mensaje", etapa: "recordatorio", texto: renderTemplate(config.txtRecordatorio, v) });
  }

  if (!changed) return SIN_CAMBIOS;
  props.pf_enviados = [...enviados].join(",");
  return { props, acciones };
}

/** Aplica la respuesta de WhatsApp del prospecto. */
export function handleReply(
  event: CalendarEvent,
  config: VendedorConfig,
  texto: string,
  now: number,
): Plan {
  const props = { ...(event.extendedProperties?.private ?? {}) };
  const estado = props.pf_estado;
  const enviados = parseEnviados(props);
  const codigo = normalizeReply(texto);
  const v = vars(event, props, config);
  const msg = (etapa: string, tpl: string): Accion => ({
    tipo: "mensaje",
    etapa,
    texto: renderTemplate(tpl, v),
  });

  const cancelar = (): Plan => ({
    props,
    acciones: cerrar(props, "cancelada", "cancelada", msg("respuesta_cancelar", config.txtCancelado)),
  });
  const reprogramar = (): Plan => {
    props.pf_estado = "revisar";
    props.pf_motivo = "reprogramar";
    return {
      props,
      acciones: [msg("respuesta_reprogramar", config.txtReprogramar), { tipo: "notificar", motivo: "reprogramar" }],
    };
  };

  if (estado === "confirmada") {
    if (codigo === "3") return cancelar();
    if (codigo === "2") return reprogramar();
    return SIN_CAMBIOS;
  }

  if (estado !== "agendada" || !enviados.includes("confirmacion")) return SIN_CAMBIOS;

  if (codigo === "1") {
    props.pf_estado = "confirmada";
    props.pf_confirmado_en = new Date(now).toISOString();
    return { props, acciones: [msg("respuesta_confirmar", config.txtConfirmado)] };
  }
  if (codigo === "2") return reprogramar();
  if (codigo === "3") return cancelar();

  const intentos = Number(props.pf_no_entendido || "0") + 1;
  props.pf_no_entendido = String(intentos);
  if (intentos <= 1) {
    return {
      props,
      acciones: [
        {
          tipo: "mensaje",
          etapa: "respuesta_no_entendido",
          texto: `${renderTemplate(config.txtNoEntendido, v)}\n\n${OPCIONES_TXT}`,
        },
      ],
    };
  }
  props.pf_estado = "revisar";
  props.pf_motivo = "no_entendido";
  return { props, acciones: [{ tipo: "notificar", motivo: "no_entendido", detalle: texto.slice(0, 300) }] };
}

/** Texto para la UI con la siguiente acción automática. */
export function proximaAccion(event: CalendarEvent, config: VendedorConfig): string {
  const props = event.extendedProperties?.private ?? {};
  const inicio = Date.parse(event.start?.dateTime ?? "");
  const enviados = parseEnviados(props);
  const liberarAt = inicio - config.liberarHoras * HORA;

  if (props.pf_forzar === "liberar") return "Liberación en curso (máx. 5 min)";
  switch (props.pf_estado) {
    case undefined:
    case "":
      return "Se detectará en los próximos 5 min";
    case "revisar":
      return "En pausa: requiere tu atención";
    case "agendada": {
      if (!enviados.includes("confirmacion")) {
        return `Confirmación · ${formatCorto(inicio - config.confHoras * HORA)}`;
      }
      const conf = Date.parse(props.pf_conf_enviada_en ?? "");
      for (let k = 1; k <= config.insistVeces; k++) {
        const at = conf + k * config.insistCadaHoras * HORA;
        if (!enviados.includes(`insistencia_${k}`) && at < liberarAt) {
          return `Insistencia ${k} · ${formatCorto(at)}`;
        }
      }
      return `Liberar cupo · ${formatCorto(liberarAt)}`;
    }
    case "confirmada":
      return enviados.includes("recordatorio")
        ? "Secuencia completa"
        : `Recordatorio · ${formatCorto(inicio - config.recordMin * MINUTO)}`;
    default:
      return "—";
  }
}
