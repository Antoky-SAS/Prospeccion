export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export function fallo(error: unknown, mensaje = "Ocurrió un error inesperado."): ActionResult<never> {
  console.error(error);
  return { ok: false, error: mensaje };
}
