import { NextResponse } from "next/server";
import { runTick } from "@/lib/motor";
import { motorAutorizado, noAutorizado } from "@/lib/motor-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** N8N lo llama cada 5 min. Devuelve los WhatsApp que debe enviar. */
export async function POST(request: Request) {
  if (!motorAutorizado(request)) return noAutorizado();
  const resultado = await runTick();
  if (resultado.errores.length) console.error("[motor/tick]", resultado.errores);
  return NextResponse.json(resultado);
}
