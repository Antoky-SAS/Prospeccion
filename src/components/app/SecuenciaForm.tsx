"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { guardarSecuencia } from "@/actions/vendedor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_CONFIG, OPCIONES_TXT } from "@/lib/core/config";
import { renderTemplate } from "@/lib/core/sequence";
import type { SecuenciaInput } from "@/schemas/config";

type TextoKey = Extract<keyof SecuenciaInput, `txt${string}`>;
type NumKey = "confHoras" | "insistVeces" | "insistCadaHoras" | "liberarHoras" | "recordMin";

const EJEMPLO = {
  nombre: "Ana",
  fecha: "lunes, 3 de noviembre",
  hora: "10:00 a. m.",
  link: "https://meet.google.com/abc-defg-hij",
};

function pick(source: SecuenciaInput): SecuenciaInput {
  const { confHoras, insistVeces, insistCadaHoras, liberarHoras, recordMin, videoUrl } = source;
  return {
    confHoras, insistVeces, insistCadaHoras, liberarHoras, recordMin, videoUrl,
    txtBienvenida: source.txtBienvenida,
    txtConfirmacion: source.txtConfirmacion,
    txtInsistencia: source.txtInsistencia,
    txtLiberado: source.txtLiberado,
    txtRecordatorio: source.txtRecordatorio,
    txtConfirmado: source.txtConfirmado,
    txtReprogramar: source.txtReprogramar,
    txtCancelado: source.txtCancelado,
    txtNoEntendido: source.txtNoEntendido,
  };
}

function Etapa(props: { titulo: string; descripcion: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{props.titulo}</CardTitle>
        <CardDescription>{props.descripcion}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{props.children}</CardContent>
    </Card>
  );
}

export function SecuenciaForm({ initial, vendedor }: { initial: SecuenciaInput; vendedor: string }) {
  const [values, setValues] = useState<SecuenciaInput>(pick(initial));
  const [pending, startTransition] = useTransition();
  const vars = { ...EJEMPLO, vendedor };

  const setNum = (k: NumKey) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: Number(e.target.value) }));

  const numero = (k: NumKey, label: string, sufijo: string) => (
    <div key={k} className="flex items-center gap-2 text-sm">
      <Label htmlFor={k} className="font-normal text-muted-foreground">{label}</Label>
      <Input id={k} type="number" min={0} className="h-8 w-20" value={values[k]} onChange={setNum(k)} />
      <span className="text-muted-foreground">{sufijo}</span>
    </div>
  );

  const mensaje = (k: TextoKey, opciones = false) => (
    <div key={k} className="grid gap-4 md:grid-cols-2">
      <Textarea
        rows={5}
        maxLength={1000}
        value={values[k]}
        onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
      />
      <div className="rounded-lg bg-[#E9EFE6] p-3">
        <div className="ml-auto max-w-[95%] whitespace-pre-wrap rounded-lg rounded-tr-none bg-white p-3 text-sm shadow-sm">
          {renderTemplate(values[k], vars)}
          {opciones && `\n\n${OPCIONES_TXT}`}
        </div>
      </div>
    </div>
  );

  const guardar = () =>
    startTransition(async () => {
      const res = await guardarSecuencia(values);
      if (res.ok) toast.success("Secuencia guardada");
      else toast.error(res.error);
    });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Variables: <code>{"{{nombre}}"}</code> <code>{"{{fecha}}"}</code> <code>{"{{hora}}"}</code>{" "}
        <code>{"{{link}}"}</code> <code>{"{{vendedor}}"}</code>. Las opciones 1/2/3 se agregan solas.
      </p>

      <Etapa titulo="1. Bienvenida" descripcion="Se envía apenas se detecta la reunión, con el video si lo configuras.">
        <div className="grid gap-2">
          <Label htmlFor="videoUrl">URL del video (mp4 público, opcional)</Label>
          <Input
            id="videoUrl"
            placeholder="https://…/video.mp4"
            value={values.videoUrl}
            onChange={(e) => setValues((v) => ({ ...v, videoUrl: e.target.value }))}
          />
        </div>
        {mensaje("txtBienvenida")}
      </Etapa>

      <Etapa titulo="2. Confirmación" descripcion="Pide responder 1, 2 o 3.">
        {numero("confHoras", "Enviar", "horas antes de la reunión")}
        {mensaje("txtConfirmacion", true)}
      </Etapa>

      <Etapa titulo="3. Insistencia" descripcion="Solo si aún no confirmó. Nunca después de la liberación.">
        <div className="flex flex-wrap gap-6">
          {numero("insistVeces", "Repetir", "veces")}
          {numero("insistCadaHoras", "cada", "horas")}
        </div>
        {mensaje("txtInsistencia", true)}
      </Etapa>

      <Etapa titulo="4. Liberar cupo" descripcion="Si no confirmó, se elimina el evento y te aviso.">
        {numero("liberarHoras", "Liberar", "horas antes de la reunión")}
        {mensaje("txtLiberado")}
      </Etapa>

      <Etapa titulo="5. Recordatorio" descripcion="Solo para reuniones confirmadas. Incluye el enlace.">
        {numero("recordMin", "Enviar", "minutos antes")}
        {mensaje("txtRecordatorio")}
      </Etapa>

      <Etapa titulo="Respuestas automáticas" descripcion="Lo que responde el sistema según la opción elegida.">
        <Label>Responde 1 · Confirmo</Label>
        {mensaje("txtConfirmado")}
        <Label>Responde 2 · Otro horario (te aviso para que lo muevas)</Label>
        {mensaje("txtReprogramar")}
        <Label>Responde 3 · No puede asistir (se elimina el evento)</Label>
        {mensaje("txtCancelado")}
        <Label>Respuesta no reconocida (la segunda vez te aviso a ti)</Label>
        {mensaje("txtNoEntendido", true)}
      </Etapa>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background/95 py-4 backdrop-blur">
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => setValues((v) => ({ ...pick({ ...v, ...DEFAULT_CONFIG }) }))}
        >
          Restaurar valores por defecto
        </Button>
        <Button disabled={pending} onClick={guardar}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
