"use server";

import { ensureInstance, fetchEstado, fetchQr, type EstadoConexion } from "@/lib/evolution";
import { requireVendedor } from "@/lib/session";
import { fallo, type ActionResult } from "./result";

export async function conectarWhatsapp(): Promise<ActionResult<{ qr: string }>> {
  const { config } = await requireVendedor();
  try {
    await ensureInstance(config.instance);
    return { ok: true, data: { qr: await fetchQr(config.instance) } };
  } catch (error) {
    return fallo(error, "No pude generar el código QR.");
  }
}

export async function estadoWhatsapp(): Promise<ActionResult<{ estado: EstadoConexion }>> {
  const { config } = await requireVendedor();
  try {
    return { ok: true, data: { estado: await fetchEstado(config.instance) } };
  } catch (error) {
    return fallo(error, "No pude consultar la conexión.");
  }
}
