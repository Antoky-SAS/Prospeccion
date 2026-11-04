"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { guardarAjustes } from "@/actions/vendedor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AjustesInput } from "@/schemas/config";

export function AjustesForm({ initial }: { initial: AjustesInput }) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof AjustesInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await guardarAjustes(values);
          if (res.ok) toast.success("Ajustes guardados");
          else toast.error(res.error);
        });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="nombre">Tu nombre (variable {"{{vendedor}}"})</Label>
        <Input id="nombre" value={values.nombre} onChange={set("nombre")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="filtroTitulo">Palabra en el título de las reuniones de venta</Label>
        <Input id="filtroTitulo" placeholder="Ej. Demo" value={values.filtroTitulo} onChange={set("filtroTitulo")} />
        <p className="text-xs text-muted-foreground">
          Solo los eventos que la contengan reciben la secuencia. Si la dejas vacía, entran todos tus eventos con hora.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="whatsappPersonal">Tu WhatsApp personal para avisos</Label>
        <Input id="whatsappPersonal" placeholder="573001234567" value={values.whatsappPersonal} onChange={set("whatsappPersonal")} />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="font-medium">Secuencia activa</p>
          <p className="text-sm text-muted-foreground">Actívala cuando tu WhatsApp esté conectado.</p>
        </div>
        <Switch checked={values.activo} onCheckedChange={(activo) => setValues((v) => ({ ...v, activo }))} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
