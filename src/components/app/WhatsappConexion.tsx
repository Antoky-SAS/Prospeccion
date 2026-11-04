"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { conectarWhatsapp, estadoWhatsapp } from "@/actions/whatsapp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Estado = "open" | "connecting" | "close" | "error";

export function WhatsappConexion({ instance }: { instance: string }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [qr, setQr] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let activo = true;
    const consultar = async () => {
      const res = await estadoWhatsapp();
      if (!activo) return;
      const nuevo = res.ok ? res.data!.estado : "error";
      setEstado(nuevo);
      if (nuevo === "open") setQr("");
    };
    consultar();
    const id = setInterval(consultar, qr ? 4000 : 30000);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [qr]);

  const conectar = () =>
    startTransition(async () => {
      const res = await conectarWhatsapp();
      if (res.ok && res.data?.qr) setQr(res.data.qr);
      else if (res.ok) toast.info("La instancia ya está conectada o el QR aún no está listo. Intenta de nuevo.");
      else toast.error(res.error);
    });

  const etiqueta: Record<Estado, string> = {
    open: "Conectado",
    connecting: "Conectando…",
    close: "Desconectado",
    error: "No disponible",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Instancia {instance}</span>
        {estado && (
          <Badge variant={estado === "open" ? "default" : "outline"}>{etiqueta[estado]}</Badge>
        )}
      </div>
      {estado !== "open" && (
        <Button onClick={conectar} disabled={pending}>
          {pending ? "Generando QR…" : qr ? "Generar otro QR" : "Conectar WhatsApp"}
        </Button>
      )}
      {qr && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Código QR de WhatsApp" className="size-64 rounded-lg border bg-white p-2" />
          <p className="text-sm text-muted-foreground">
            WhatsApp → Dispositivos vinculados → Vincular un dispositivo. Usa el número desde el que escribirás a tus prospectos.
          </p>
        </div>
      )}
    </div>
  );
}
