import { NextResponse } from "next/server";
import { procesarRespuesta } from "@/lib/motor";
import { motorAutorizado, noAutorizado } from "@/lib/motor-auth";
import { EvolutionUpsertSchema } from "@/schemas/evolution";

export const dynamic = "force-dynamic";

/**
 * Recibe el payload `messages.upsert` de Evolution API tal cual, reenviado por N8N.
 * Devuelve los WhatsApp que N8N debe enviar como respuesta.
 */
export async function POST(request: Request) {
  if (!motorAutorizado(request)) return noAutorizado();

  const parsed = EvolutionUpsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ envios: [], ignorado: "payload" });

  const { instance, data } = parsed.data;
  const jid = data.key.remoteJid.endsWith("@lid") ? (data.key.remoteJidAlt ?? "") : data.key.remoteJid;
  const texto = data.message?.conversation ?? data.message?.extendedTextMessage?.text ?? "";

  if (data.key.fromMe || !jid.endsWith("@s.whatsapp.net") || !texto.trim()) {
    return NextResponse.json({ envios: [], ignorado: "mensaje" });
  }

  const envios = await procesarRespuesta(instance, jid.split("@")[0], texto);
  return NextResponse.json({ envios });
}
