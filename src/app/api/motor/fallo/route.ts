import { NextResponse } from "next/server";
import { registrarFallo } from "@/lib/motor";
import { motorAutorizado, noAutorizado } from "@/lib/motor-auth";
import { FalloSchema } from "@/schemas/evolution";

export const dynamic = "force-dynamic";

/** N8N avisa que un envío falló: la reunión pasa a revisión. */
export async function POST(request: Request) {
  if (!motorAutorizado(request)) return noAutorizado();
  const parsed = FalloSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  // Un aviso al vendedor que falla no cambia el estado de la reunión.
  if (parsed.data.etapa?.startsWith("aviso_")) return NextResponse.json({ ok: true, ignorado: true });
  await registrarFallo(parsed.data.calendarId, parsed.data.eventId);
  return NextResponse.json({ ok: true });
}
