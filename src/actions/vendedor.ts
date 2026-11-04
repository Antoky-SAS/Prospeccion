"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireVendedor } from "@/lib/session";
import { auth, signOut } from "@/auth";
import { DEFAULT_CONFIG, instanceNameFor } from "@/lib/core/config";
import { normalizePhone } from "@/lib/core/sequence";
import { canAccessCalendar, ensureCalendarInList, getConfig, saveConfig } from "@/lib/google/calendar";
import { AjustesSchema, SecuenciaSchema, type AjustesInput, type SecuenciaInput } from "@/schemas/config";
import { fallo, type ActionResult } from "./result";

export async function completarOnboarding(): Promise<ActionResult> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return { ok: false, error: "Tu sesión expiró." };

  try {
    if (!(await canAccessCalendar(email))) {
      return { ok: false, error: "Aún no tengo acceso a tu calendario. Revisa que lo compartiste con permiso para hacer cambios." };
    }
    await ensureCalendarInList(email);
    if (!(await getConfig(email))) {
      await saveConfig(email, {
        ...DEFAULT_CONFIG,
        nombre: session?.user?.name ?? email.split("@")[0],
        email,
        instance: instanceNameFor(email),
        activo: false,
      });
    }
  } catch (error) {
    return fallo(error, "No pude conectar tu calendario.");
  }
  redirect("/ajustes");
}

export async function guardarSecuencia(input: SecuenciaInput): Promise<ActionResult> {
  const parsed = SecuenciaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { email, config } = await requireVendedor();
  try {
    await saveConfig(email, { ...config, ...parsed.data });
  } catch (error) {
    return fallo(error, "No pude guardar la secuencia.");
  }
  revalidatePath("/secuencia");
  revalidatePath("/");
  return { ok: true };
}

export async function guardarAjustes(input: AjustesInput): Promise<ActionResult> {
  const parsed = AjustesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const whatsappPersonal = normalizePhone(parsed.data.whatsappPersonal);
  if (!whatsappPersonal) return { ok: false, error: "Número de WhatsApp inválido." };

  const { email, config } = await requireVendedor();
  try {
    await saveConfig(email, { ...config, ...parsed.data, whatsappPersonal });
  } catch (error) {
    return fallo(error, "No pude guardar los ajustes.");
  }
  revalidatePath("/ajustes");
  return { ok: true };
}

export async function cerrarSesion(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
