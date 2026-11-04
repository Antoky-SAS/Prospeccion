import "server-only";
import { redirect } from "next/navigation";
import { getSessionEmail } from "@/auth";
import type { VendedorConfig } from "@/interface/types";
import { getConfig } from "@/lib/google/calendar";

/** Vendedor en sesión con su configuración; redirige si falta algo. */
export async function requireVendedor(): Promise<{ email: string; config: VendedorConfig }> {
  const email = await getSessionEmail();
  if (!email) redirect("/login");
  const config = await getConfig(email);
  if (!config) redirect("/onboarding");
  return { email, config };
}
