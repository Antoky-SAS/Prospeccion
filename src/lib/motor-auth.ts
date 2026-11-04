import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/** Valida el header x-motor-token que envía N8N. */
export function motorAutorizado(request: Request): boolean {
  const esperado = process.env.MOTOR_TOKEN ?? "";
  const recibido = request.headers.get("x-motor-token") ?? "";
  if (!esperado || esperado.length !== recibido.length) return false;
  return timingSafeEqual(Buffer.from(esperado), Buffer.from(recibido));
}

export const noAutorizado = () => NextResponse.json({ error: "No autorizado" }, { status: 401 });
