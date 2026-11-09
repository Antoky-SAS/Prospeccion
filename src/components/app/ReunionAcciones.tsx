"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cambiarReunion } from "@/actions/reuniones";
import { Button } from "@/components/ui/button";
import type { Estado } from "@/interface/types";

export function ReunionAcciones({ eventId, estado }: { eventId: string; estado: Estado | null }) {
  const [pending, startTransition] = useTransition();
  const [confirmandoLiberar, setConfirmandoLiberar] = useState(false);

  const run = (cambio: "confirmar" | "reactivar" | "liberar", ok: string) =>
    startTransition(async () => {
      const res = await cambiarReunion(eventId, cambio);
      if (res.ok) toast.success(ok);
      else toast.error(res.error);
      setConfirmandoLiberar(false);
    });

  if (!estado || estado === "liberada" || estado === "cancelada") return null;

  return (
    <div className="flex flex-wrap gap-2">
      {estado !== "confirmada" && (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run("confirmar", "Reunión confirmada. Se le avisará al prospecto en la próxima corrida.")}>
          Confirmar
        </Button>
      )}
      {estado === "revisar" && (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run("reactivar", "Secuencia reactivada")}>
          Reactivar
        </Button>
      )}
      {confirmandoLiberar ? (
        <>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => run("liberar", "Se liberará en los próximos minutos")}
          >
            Sí, liberar
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmandoLiberar(false)}>
            No
          </Button>
        </>
      ) : (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmandoLiberar(true)}>
          Liberar cupo
        </Button>
      )}
    </div>
  );
}
