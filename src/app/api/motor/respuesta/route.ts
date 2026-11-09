import { NextResponse } from "next/server";
import { procesarRespuesta } from "@/lib/motor";
import { resolverLid } from "@/lib/evolution";
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
  // WhatsApp puede identificar al remitente con un ID interno (@lid); el número real viene en otro campo.
  let jid =
    [data.key.remoteJid, data.key.remoteJidAlt, data.key.senderPn, data.senderPn].find((j) =>
      j?.endsWith("@s.whatsapp.net"),
    ) ?? "";
  const texto = data.message?.conversation ?? data.message?.extendedTextMessage?.text ?? "";

  if (data.key.fromMe) return NextResponse.json({ envios: [], ignorado: "mensaje propio" });
  if (data.key.remoteJid.endsWith("@g.us")) return NextResponse.json({ envios: [], ignorado: "grupo" });
  if (!jid && data.key.remoteJid.endsWith("@lid")) {
    jid = (await resolverLid(instance, data.key.remoteJid).catch(() => null)) ?? "";
  }
  if (!jid) return NextResponse.json({ envios: [], ignorado: `sin número real (${data.key.remoteJid})` });
  if (!texto.trim()) return NextResponse.json({ envios: [], ignorado: "sin texto" });

  return NextResponse.json(await procesarRespuesta(instance, jid.split("@")[0], texto));
}
