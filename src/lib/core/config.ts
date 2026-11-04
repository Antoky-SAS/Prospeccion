import type { VendedorConfig } from "@/interface/types";

export const OPCIONES_TXT = [
  "Responde con un número:",
  "1️⃣ Confirmo",
  "2️⃣ Necesito otro horario",
  "3️⃣ Ya no puedo asistir",
].join("\n");

export const DEFAULT_CONFIG: Omit<VendedorConfig, "nombre" | "email" | "instance"> = {
  filtroTitulo: "",
  whatsappPersonal: "",
  activo: true,
  confHoras: 24,
  insistVeces: 2,
  insistCadaHoras: 3,
  liberarHoras: 4,
  recordMin: 60,
  videoUrl: "",
  txtBienvenida:
    "Hola {{nombre}} 👋 Soy {{vendedor}}. Gracias por agendar nuestra reunión del {{fecha}} a las {{hora}}.\n\nTe dejo este video corto: explica cómo será la reunión y qué conviene tener a mano para aprovecharla.",
  txtConfirmacion:
    "Hola {{nombre}}, te recuerdo nuestra reunión del {{fecha}} a las {{hora}}. ¿Me confirmas tu asistencia?",
  txtInsistencia:
    "{{nombre}}, aún no tengo tu confirmación para la reunión del {{fecha}} a las {{hora}}. Si no confirmas, liberaré el espacio para otra persona.",
  txtLiberado:
    "{{nombre}}, como no recibí confirmación, liberé el espacio de la reunión del {{fecha}}. Si quieres retomarla, escríbeme y buscamos otro horario.",
  txtRecordatorio:
    "{{nombre}}, nos vemos en una hora ({{hora}}). Este es el enlace de la reunión: {{link}}",
  txtConfirmado: "¡Gracias, {{nombre}}! Quedó confirmada la reunión del {{fecha}} a las {{hora}}.",
  txtReprogramar: "Entendido, {{nombre}}. En un momento te escribo para buscar otro horario.",
  txtCancelado: "Entendido, {{nombre}}. Cancelé la reunión. Si más adelante quieres retomarla, escríbeme.",
  txtNoEntendido: "No logré entender tu respuesta 🙏",
};

/** Correspondencia campo → propiedad privada del evento de configuración. */
const KEYS: Record<keyof VendedorConfig, string> = {
  nombre: "pf_nombre",
  email: "pf_email",
  filtroTitulo: "pf_filtro_titulo",
  instance: "pf_instance",
  whatsappPersonal: "pf_whatsapp_personal",
  activo: "pf_activo",
  confHoras: "pf_conf_horas",
  insistVeces: "pf_insist_veces",
  insistCadaHoras: "pf_insist_cada_horas",
  liberarHoras: "pf_liberar_horas",
  recordMin: "pf_record_min",
  videoUrl: "pf_video_url",
  txtBienvenida: "pf_txt_bienvenida",
  txtConfirmacion: "pf_txt_confirmacion",
  txtInsistencia: "pf_txt_insistencia",
  txtLiberado: "pf_txt_liberado",
  txtRecordatorio: "pf_txt_recordatorio",
  txtConfirmado: "pf_txt_confirmado",
  txtReprogramar: "pf_txt_reprogramar",
  txtCancelado: "pf_txt_cancelado",
  txtNoEntendido: "pf_txt_no_entendido",
};

const NUMERIC: (keyof VendedorConfig)[] = [
  "confHoras",
  "insistVeces",
  "insistCadaHoras",
  "liberarHoras",
  "recordMin",
];

export function configFromProps(props: Record<string, string>): VendedorConfig {
  const base = { ...DEFAULT_CONFIG, nombre: "", email: "", instance: "" } as VendedorConfig;
  const out = { ...base } as Record<keyof VendedorConfig, unknown>;
  for (const [field, key] of Object.entries(KEYS) as [keyof VendedorConfig, string][]) {
    const raw = props[key];
    if (raw === undefined) continue;
    if (field === "activo") out[field] = raw === "true";
    else if (NUMERIC.includes(field)) {
      const n = Number(raw);
      if (Number.isFinite(n)) out[field] = n;
    } else out[field] = raw;
  }
  return out as VendedorConfig;
}

export function configToProps(config: VendedorConfig): Record<string, string> {
  const props: Record<string, string> = { pf_tipo: "config" };
  for (const [field, key] of Object.entries(KEYS) as [keyof VendedorConfig, string][]) {
    props[key] = String(config[field]);
  }
  return props;
}

export function instanceNameFor(email: string): string {
  const local = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  return `prosp-${local}`;
}
