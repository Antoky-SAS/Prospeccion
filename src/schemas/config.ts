import { z } from "zod";

const texto = (max = 1000) => z.string().trim().min(1, "Requerido").max(max, `Máximo ${max} caracteres`);
const entero = (min: number, max: number) => z.coerce.number().int("Debe ser entero").min(min).max(max);

export const SecuenciaSchema = z
  .object({
    confHoras: entero(1, 168),
    insistVeces: entero(0, 5),
    insistCadaHoras: entero(1, 48),
    liberarHoras: entero(1, 72),
    recordMin: entero(5, 1440),
    videoUrl: z.union([z.literal(""), z.url("URL inválida").max(1000)]),
    txtBienvenida: texto(),
    txtConfirmacion: texto(),
    txtInsistencia: texto(),
    txtLiberado: texto(),
    txtRecordatorio: texto(),
    txtConfirmado: texto(),
    txtReprogramar: texto(),
    txtCancelado: texto(),
    txtNoEntendido: texto(),
  })
  .refine((v) => v.liberarHoras < v.confHoras, {
    path: ["liberarHoras"],
    message: "Debe ser menor que las horas de confirmación",
  });

export type SecuenciaInput = z.infer<typeof SecuenciaSchema>;

export const AjustesSchema = z.object({
  nombre: texto(80),
  filtroTitulo: z.string().trim().max(80),
  whatsappPersonal: z
    .string()
    .trim()
    .regex(/^\+?[\d\s-]{10,16}$/, "Número inválido (ej. 573001234567)"),
  activo: z.boolean(),
});

export type AjustesInput = z.infer<typeof AjustesSchema>;
