import "server-only";

const URL_BASE = process.env.EVOLUTION_API_URL ?? "";
const KEY = process.env.EVOLUTION_API_KEY ?? "";
const WEBHOOK = process.env.N8N_RESPUESTAS_WEBHOOK_URL ?? "";

export type EstadoConexion = "open" | "connecting" | "close";

async function evo(path: string, init: RequestInit = {}): Promise<Response> {
  if (!URL_BASE || !KEY) throw new Error("Evolution API no está configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY).");
  return fetch(`${URL_BASE}${path}`, {
    ...init,
    headers: { apikey: KEY, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
}

/** Crea la instancia si no existe y apunta su webhook al flujo de respuestas de N8N. */
export async function ensureInstance(instance: string): Promise<void> {
  const res = await evo("/instance/create", {
    method: "POST",
    body: JSON.stringify({ instanceName: instance, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
  });
  if (!res.ok && ![403, 409].includes(res.status)) {
    throw new Error(`No se pudo crear la instancia (${res.status}).`);
  }

  if (!WEBHOOK) throw new Error("Falta N8N_RESPUESTAS_WEBHOOK_URL.");
  const hook = await evo(`/webhook/set/${instance}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: { enabled: true, url: WEBHOOK, byEvents: false, base64: false, events: ["MESSAGES_UPSERT"] },
    }),
  });
  if (!hook.ok) throw new Error(`No se pudo configurar el webhook (${hook.status}).`);
}

export async function fetchQr(instance: string): Promise<string> {
  const res = await evo(`/instance/connect/${instance}`);
  if (!res.ok) throw new Error(`No se pudo obtener el QR (${res.status}).`);
  const data = await res.json();
  return data?.base64 ?? data?.qrcode?.base64 ?? "";
}

export async function fetchEstado(instance: string): Promise<EstadoConexion> {
  const res = await evo(`/instance/connectionState/${instance}`);
  if (res.status === 404) return "close";
  if (!res.ok) throw new Error(`No se pudo consultar la conexión (${res.status}).`);
  const data = await res.json();
  const state = data?.instance?.state ?? data?.state;
  return state === "open" || state === "connecting" ? state : "close";
}
