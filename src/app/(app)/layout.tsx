import { cerrarSesion } from "@/actions/vendedor";
import { AppNav } from "@/components/app/AppNav";
import { Button } from "@/components/ui/button";
import { requireVendedor } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireVendedor();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-primary">Prospección</span>
            <AppNav />
          </div>
          <form action={cerrarSesion} className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>
            <Button type="submit" variant="ghost" size="sm">
              Salir
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
