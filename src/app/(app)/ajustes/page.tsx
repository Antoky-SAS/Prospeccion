import { AjustesForm } from "@/components/app/AjustesForm";
import { WhatsappConexion } from "@/components/app/WhatsappConexion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireVendedor } from "@/lib/session";

export default async function AjustesPage() {
  const { config } = await requireVendedor();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-primary">Ajustes</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">WhatsApp de prospección</CardTitle>
        </CardHeader>
        <CardContent>
          <WhatsappConexion instance={config.instance} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent>
          <AjustesForm
            initial={{
              nombre: config.nombre,
              filtroTitulo: config.filtroTitulo,
              whatsappPersonal: config.whatsappPersonal,
              activo: config.activo,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
