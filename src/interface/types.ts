export type Estado = "agendada" | "confirmada" | "revisar" | "liberada" | "cancelada";

export type Etapa =
  | "bienvenida"
  | "confirmacion"
  | `insistencia_${number}`
  | "liberar"
  | "recordatorio";

export type Motivo =
  | "sin_telefono"
  | "reprogramar"
  | "no_entendido"
  | "cancelada"
  | "liberada"
  | "envio_fallido";

export interface VendedorConfig {
  nombre: string;
  email: string;
  filtroTitulo: string;
  instance: string;
  whatsappPersonal: string;
  activo: boolean;
  confHoras: number;
  insistVeces: number;
  insistCadaHoras: number;
  liberarHoras: number;
  recordMin: number;
  videoUrl: string;
  txtBienvenida: string;
  txtConfirmacion: string;
  txtInsistencia: string;
  txtLiberado: string;
  txtRecordatorio: string;
  txtConfirmado: string;
  txtReprogramar: string;
  txtCancelado: string;
  txtNoEntendido: string;
}

/** Subconjunto del recurso Event de Google Calendar que usamos. */
export interface CalendarEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email?: string; displayName?: string; organizer?: boolean; self?: boolean }[];
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  extendedProperties?: { private?: Record<string, string> };
}

/** Mensaje que N8N debe enviar por Evolution API. */
export interface Envio {
  instance: string;
  numero: string;
  texto: string;
  mediaUrl?: string;
  etapa: string;
  eventId: string;
  calendarId: string;
}

export interface Reunion {
  id: string;
  calendarId: string;
  titulo: string;
  inicio: string;
  estado: Estado | null;
  nombre: string;
  telefono: string;
  enviados: string[];
  motivo: string;
  proximaAccion: string;
}
