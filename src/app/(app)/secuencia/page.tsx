import { SecuenciaForm } from "@/components/app/SecuenciaForm";
import { requireVendedor } from "@/lib/session";

export default async function SecuenciaPage() {
  const { config } = await requireVendedor();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Secuencia</h1>
        <p className="text-sm text-muted-foreground">Textos y tiempos de cada etapa. Los cambios aplican desde la próxima corrida (≤ 5 min).</p>
      </div>
      <SecuenciaForm initial={config} vendedor={config.nombre} />
    </div>
  );
}
