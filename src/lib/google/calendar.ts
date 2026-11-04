import "server-only";
import { JWT } from "google-auth-library";
import type { CalendarEvent, VendedorConfig } from "@/interface/types";
import { configFromProps, configToProps } from "@/lib/core/config";

const API = "https://www.googleapis.com/calendar/v3";

const jwt = new JWT({
  email: process.env.GOOGLE_SA_EMAIL,
  key: (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/calendar"],
});

export class CalendarError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function gcal<T>(path: string, init: RequestInit & { query?: Record<string, string> } = {}): Promise<T> {
  const { token } = await jwt.getAccessToken();
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);

  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new CalendarError(res.status, `Google Calendar ${res.status}: ${await res.text()}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const enc = encodeURIComponent;

// ---------- Vendedores ----------

/** Calendarios compartidos con la service account (uno por vendedor). */
export async function listSellerCalendars(): Promise<string[]> {
  const data = await gcal<{ items?: { id: string; accessRole: string }[] }>("/users/me/calendarList", {
    query: { minAccessRole: "writer" },
  });
  return (data.items ?? []).map((c) => c.id);
}

/** Agrega el calendario compartido a la lista de la service account. Idempotente. */
export async function ensureCalendarInList(calendarId: string): Promise<void> {
  try {
    await gcal("/users/me/calendarList", { method: "POST", body: JSON.stringify({ id: calendarId }) });
  } catch (error) {
    if (error instanceof CalendarError && error.status === 409) return;
    throw error;
  }
}

/** Devuelve null si no hay configuración o si el calendario aún no está compartido. */
export async function getConfigEvent(calendarId: string): Promise<CalendarEvent | null> {
  try {
    const data = await gcal<{ items?: CalendarEvent[] }>(`/calendars/${enc(calendarId)}/events`, {
      query: {
        privateExtendedProperty: "pf_tipo=config",
        timeMin: "1999-12-31T00:00:00Z",
        timeMax: "2000-01-03T00:00:00Z",
        singleEvents: "true",
      },
    });
    return data.items?.[0] ?? null;
  } catch (error) {
    if (error instanceof CalendarError && [403, 404].includes(error.status)) return null;
    throw error;
  }
}

export async function getConfig(calendarId: string): Promise<VendedorConfig | null> {
  const event = await getConfigEvent(calendarId);
  return event ? configFromProps(event.extendedProperties?.private ?? {}) : null;
}

export async function saveConfig(calendarId: string, config: VendedorConfig): Promise<void> {
  const existing = await getConfigEvent(calendarId);
  const body = {
    summary: "⚙️ Prospección · configuración (no borrar)",
    description: "Evento técnico de la herramienta de prospección. No lo edites ni lo borres.",
    start: { date: "2000-01-01" },
    end: { date: "2000-01-02" },
    transparency: "transparent",
    visibility: "private",
    extendedProperties: { private: configToProps(config) },
  };
  if (existing) {
    await gcal(`/calendars/${enc(calendarId)}/events/${enc(existing.id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  } else {
    await gcal(`/calendars/${enc(calendarId)}/events`, { method: "POST", body: JSON.stringify(body) });
  }
}

/** ¿La service account puede escribir en el calendario? */
export async function canAccessCalendar(calendarId: string): Promise<boolean> {
  try {
    await gcal(`/calendars/${enc(calendarId)}/events`, { query: { maxResults: "1" } });
    return true;
  } catch (error) {
    if (error instanceof CalendarError && [403, 404].includes(error.status)) return false;
    throw error;
  }
}

// ---------- Reuniones ----------

export async function listReuniones(
  calendarId: string,
  filtroTitulo: string,
  desde = new Date(),
  dias = 14,
): Promise<CalendarEvent[]> {
  const hasta = new Date(desde.getTime() + dias * 86_400_000);
  const data = await gcal<{ items?: CalendarEvent[] }>(`/calendars/${enc(calendarId)}/events`, {
    query: {
      timeMin: desde.toISOString(),
      timeMax: hasta.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    },
  });
  const filtro = filtroTitulo.trim().toLowerCase();
  return (data.items ?? []).filter(
    (e) =>
      e.status !== "cancelled" &&
      !!e.start?.dateTime &&
      e.extendedProperties?.private?.pf_tipo !== "config" &&
      (!filtro || (e.summary ?? "").toLowerCase().includes(filtro)),
  );
}

export async function findReunionByPhone(calendarId: string, telefono: string): Promise<CalendarEvent | null> {
  const data = await gcal<{ items?: CalendarEvent[] }>(`/calendars/${enc(calendarId)}/events`, {
    query: {
      privateExtendedProperty: `pf_telefono=${telefono}`,
      timeMin: new Date().toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
    },
  });
  const activos = (data.items ?? []).filter((e) =>
    ["agendada", "confirmada"].includes(e.extendedProperties?.private?.pf_estado ?? ""),
  );
  return activos[0] ?? null;
}

export async function getReunion(calendarId: string, eventId: string): Promise<CalendarEvent> {
  return gcal<CalendarEvent>(`/calendars/${enc(calendarId)}/events/${enc(eventId)}`);
}

/** Reemplaza el mapa completo de propiedades privadas del evento. */
export async function patchReunionProps(
  calendarId: string,
  eventId: string,
  props: Record<string, string>,
): Promise<void> {
  await gcal(`/calendars/${enc(calendarId)}/events/${enc(eventId)}`, {
    method: "PATCH",
    query: { sendUpdates: "none" },
    body: JSON.stringify({ extendedProperties: { private: props } }),
  });
}

/** Elimina la reunión y avisa a los invitados, lo que libera el cupo. */
export async function deleteReunion(calendarId: string, eventId: string): Promise<void> {
  try {
    await gcal(`/calendars/${enc(calendarId)}/events/${enc(eventId)}`, {
      method: "DELETE",
      query: { sendUpdates: "all" },
    });
  } catch (error) {
    if (error instanceof CalendarError && [404, 410].includes(error.status)) return;
    throw error;
  }
}
