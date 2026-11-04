import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await auth())?.user) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-primary">Prospección</h1>
          <p className="text-sm text-muted-foreground">Confirmación de reuniones de venta por WhatsApp.</p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <Button type="submit" size="lg" className="w-full">
            Entrar con Google
          </Button>
        </form>
        {error && (
          <p className="text-sm text-destructive">
            Tu cuenta no tiene acceso. Pide que agreguen tu email a la lista de vendedores.
          </p>
        )}
      </div>
    </main>
  );
}
