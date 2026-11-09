import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/lib/core/config";
import { handleReply, normalizeReply, planEvent, type Plan } from "../src/lib/core/sequence";
import type { CalendarEvent, VendedorConfig } from "../src/interface/types";

const H = 3600_000;
const cfg: VendedorConfig = { ...DEFAULT_CONFIG, nombre: "Carlos", email: "c@x.com", instance: "prosp-c", videoUrl: "https://v/x.mp4" };
const T0 = Date.parse("2026-11-10T15:00:00Z");
const mk = (startMs: number, props?: Record<string, string>): CalendarEvent => ({
  id: "e1", summary: "Demo MySlotFy", description: "Nombre: Ana Pérez\nTeléfono: +57 300 123 4567",
  start: { dateTime: new Date(startMs).toISOString() }, hangoutLink: "https://meet/x",
  extendedProperties: props ? { private: props } : undefined,
});
const apply = (e: CalendarEvent, p: Plan): CalendarEvent => p.props ? { ...e, extendedProperties: { private: p.props } } : e;
const etapas = (p: Plan) => p.acciones.map((a) => a.tipo === "mensaje" ? a.etapa : a.tipo === "notificar" ? `notif:${a.motivo}` : a.tipo);

// replies
assert.equal(normalizeReply("1️⃣"), "1"); assert.equal(normalizeReply(" Sí! "), "1"); assert.equal(normalizeReply("claro, ahí estaré"), null);
assert.equal(normalizeReply("No puedo."), "3"); assert.equal(normalizeReply("otro horario"), "2");

// 1) sin respuesta: bienvenida → confirmacion → insist1 → insist2 → liberar
let e = mk(T0 + 72 * H);
let now = T0; let p = planEvent(e, cfg, now);
assert.deepEqual(etapas(p), ["bienvenida"]); assert.equal(p.props!.pf_telefono, "573001234567"); assert.equal(p.props!.pf_nombre, "Ana Pérez");
e = apply(e, p);
assert.equal(planEvent(e, cfg, now + 60_000).props, null, "idempotente");
now = T0 + 48 * H; p = planEvent(e, cfg, now); assert.deepEqual(etapas(p), ["confirmacion"]); e = apply(e, p);
assert.ok((p.acciones[0] as { texto: string }).texto.includes("1️⃣ Confirmo"));
now += 3 * H; p = planEvent(e, cfg, now); assert.deepEqual(etapas(p), ["insistencia_1"]); e = apply(e, p);
now += 3 * H; p = planEvent(e, cfg, now); assert.deepEqual(etapas(p), ["insistencia_2"]); e = apply(e, p);
now += 3 * H; p = planEvent(e, cfg, now); assert.equal(p.props, null);
now = T0 + 68 * H; p = planEvent(e, cfg, now); assert.deepEqual(etapas(p), ["liberar", "eliminar", "notif:liberada"]);

// 2) confirma con "sí" → recordatorio
e = mk(T0 + 72 * H); e = apply(e, planEvent(e, cfg, T0));
assert.equal(handleReply(e, cfg, "1", T0).props, null, "ignora antes de confirmación");
e = apply(e, planEvent(e, cfg, T0 + 48 * H));
p = handleReply(e, cfg, "sí", T0 + 49 * H); assert.equal(p.props!.pf_estado, "confirmada"); e = apply(e, p);
assert.equal(planEvent(e, cfg, T0 + 60 * H).props, null, "sin insistencia");
p = planEvent(e, cfg, T0 + 71.2 * H); assert.deepEqual(etapas(p), ["recordatorio"]);
assert.ok((p.acciones[0] as { texto: string }).texto.includes("https://meet/x"));

// 3) no entendido x2 → revisar; pausa
e = mk(T0 + 72 * H); e = apply(e, planEvent(e, cfg, T0)); e = apply(e, planEvent(e, cfg, T0 + 48 * H));
p = handleReply(e, cfg, "claro, ahí estaré", T0 + 49 * H); assert.deepEqual(etapas(p), ["respuesta_no_entendido"]); e = apply(e, p);
p = handleReply(e, cfg, "ok perfecto", T0 + 49 * H); assert.deepEqual(etapas(p), ["notif:no_entendido"]); e = apply(e, p);
assert.equal(e.extendedProperties!.private!.pf_estado, "revisar");
assert.equal(planEvent(e, cfg, T0 + 69 * H).props, null, "pausado: no libera");

// 4) opción 2 → revisar; mover evento → reinicia
e = mk(T0 + 72 * H); e = apply(e, planEvent(e, cfg, T0)); e = apply(e, planEvent(e, cfg, T0 + 48 * H));
p = handleReply(e, cfg, "2", T0 + 49 * H); assert.deepEqual(etapas(p), ["respuesta_reprogramar", "notif:reprogramar"]); e = apply(e, p);
e = { ...e, start: { dateTime: new Date(T0 + 120 * H).toISOString() } };
p = planEvent(e, cfg, T0 + 50 * H); assert.equal(p.props!.pf_estado, "agendada"); assert.equal(p.props!.pf_enviados, "bienvenida");

// 5) opción 3 → cancela
e = mk(T0 + 72 * H); e = apply(e, planEvent(e, cfg, T0)); e = apply(e, planEvent(e, cfg, T0 + 48 * H));
assert.deepEqual(etapas(handleReply(e, cfg, "3", T0 + 49 * H)), ["respuesta_cancelar", "eliminar", "notif:cancelada"]);

// 6) agendada con < 4h → confirmada directa, bienvenida (+ recordatorio si toca)
p = planEvent(mk(T0 + 2 * H), cfg, T0); assert.equal(p.props!.pf_estado, "confirmada"); assert.deepEqual(etapas(p), ["bienvenida"]);
p = planEvent(mk(T0 + 0.5 * H), cfg, T0); assert.deepEqual(etapas(p), ["bienvenida", "recordatorio"]);

// 7) agendada con 10h → bienvenida + confirmación inmediata
p = planEvent(mk(T0 + 10 * H), cfg, T0); assert.deepEqual(etapas(p), ["bienvenida", "confirmacion"]);

// 8) sin teléfono → revisar
p = planEvent({ ...mk(T0 + 72 * H), description: "sin datos" }, cfg, T0); assert.deepEqual(etapas(p), ["notif:sin_telefono"]);

// 9) liberar forzado desde UI
e = mk(T0 + 72 * H); e = apply(e, planEvent(e, cfg, T0));
e.extendedProperties!.private!.pf_forzar = "liberar";
assert.deepEqual(etapas(planEvent(e, cfg, T0 + H)), ["liberar", "eliminar", "notif:liberada"]);

console.log("OK: todos los escenarios pasan");

// 10) nombre desde el título de una reserva de Google
{
  const ev: CalendarEvent = { id: "e2", summary: "Demo (Ana Pérez)", description: "Teléfono: 3001234567",
    start: { dateTime: new Date(T0 + 72 * H).toISOString() }, attendees: [{ email: "anaperez@gmail.com" }] };
  const plan = planEvent(ev, cfg, T0);
  assert.equal(plan.props!.pf_nombre, "Ana Pérez");
  assert.ok((plan.acciones[0] as { texto: string }).texto.startsWith("Hola Ana"));
  console.log("OK: nombre desde el título");
}

// 11) confirmación manual desde la app avisa al prospecto una sola vez
{
  let ev = mk(T0 + 72 * H); ev = apply(ev, planEvent(ev, cfg, T0)); ev = apply(ev, planEvent(ev, cfg, T0 + 48 * H));
  ev.extendedProperties!.private!.pf_estado = "confirmada";
  ev.extendedProperties!.private!.pf_avisar = "confirmado";
  const plan = planEvent(ev, cfg, T0 + 49 * H);
  assert.deepEqual(etapas(plan), ["confirmado_manual"]);
  assert.equal(plan.props!.pf_avisar, "");
  assert.equal(planEvent(apply(ev, plan), cfg, T0 + 49 * H).props, null, "no se repite");
  console.log("OK: confirmación manual avisa al prospecto");
}
