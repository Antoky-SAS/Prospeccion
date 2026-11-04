import { redirect } from "next/navigation";
import { getSessionEmail } from "@/auth";
import { OnboardingButton } from "@/components/app/OnboardingButton";
import { getConfig } from "@/lib/google/calendar";

export default async function OnboardingPage() {
  const email = await getSessionEmail();
  if (!email) redirect("/login");
  if (await getConfig(email)) redirect("/");

  const sa = process.env.GOOGLE_SA_EMAIL ?? "";

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16">
      <h1 className="text-2xl font-semibold text-primary">Conecta tu calendario</h1>
      <p className="mt-2 text-muted-foreground">
        Las reuniones y tu configuración se guardan en tu Google Calendar ({email}). Para que el sistema pueda
        leerlas, compártelo una sola vez:
      </p>
      <ol className="mt-8 list-decimal space-y-3 pl-5 text-sm leading-relaxed">
        <li>Abre Google Calendar → Configuración → tu calendario → «Compartir con personas específicas».</li>
        <li>
          Agrega <code className="rounded bg-muted px-1.5 py-0.5 break-all">{sa}</code>
        </li>
        <li>Elige el permiso «Hacer cambios en eventos» y guarda.</li>
      </ol>
      <div className="mt-10">
        <OnboardingButton />
      </div>
    </main>
  );
}
