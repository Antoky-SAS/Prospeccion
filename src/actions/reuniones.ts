"use server";

import { revalidatePath } from "next/cache";
import { getReunion, patchReunionProps } from "@/lib/google/calendar";
import { requireVendedor } from "@/lib/session";
import { fallo, type ActionResult } from "./result";

type Cambio = "confirmar" | "reactivar" | "liberar";

/** Cambios manuales del vendedor. Los mensajes los envía el motor en su próxima corrida. */
export async function cambiarReunion(eventId: string, cambio: Cambio): Promise<ActionResult> {
  const { email } = await requireVendedor();
  try {
    const event = await getReunion(email, eventId);
    const props = { ...(event.extendedProperties?.private ?? {}) };
    if (!props.pf_estado && cambio !== "liberar") return { ok: false, error: "La reunión aún no fue detectada." };

    if (cambio === "confirmar") {
      Object.assign(props, { pf_estado: "confirmada", pf_motivo: "", pf_confirmado_en: new Date().toISOString() });
    } else if (cambio === "reactivar") {
      // Sin teléfono: se reinicia para volver a leer la descripción del evento.
      if (props.pf_motivo === "sin_telefono") props.pf_estado = "";
      else Object.assign(props, { pf_estado: "agendada", pf_no_entendido: "0" });
      props.pf_motivo = "";
    } else {
      props.pf_forzar = "liberar";
    }

    await patchReunionProps(email, eventId, props);
  } catch (error) {
    return fallo(error, "No pude actualizar la reunión.");
  }
  revalidatePath("/");
  return { ok: true };
}
