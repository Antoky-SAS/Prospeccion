# Prospección

Confirmación automática de reuniones de venta por WhatsApp. Sin base de datos: todo vive en Google Calendar.

Cuando un prospecto agenda una reunión en tu calendario:

| Etapa | Cuándo (por defecto) | Condición |
|---|---|---|
| 1. Bienvenida + video | Al detectar la reunión | Siempre |
| 2. Confirmación 1/2/3 | 24 h antes | Sin confirmar |
| 3. Insistencia | 2 veces, cada 3 h | Sin confirmar, antes de liberar |
| 4. Liberar cupo | 4 h antes | Sin confirmar: se elimina el evento y te aviso |
| 5. Recordatorio con enlace | 60 min antes | Solo confirmadas |

Tiempos, textos y video se editan en **/secuencia**. El prospecto responde con un número:

- `1` (o «sí», «confirmo», «ok») → confirmada.
- `2` → queda en **Revisar** y te aviso; mueve el evento en Calendar y la secuencia se reinicia sola.
- `3` → se cancela y se elimina el evento.
- Otra cosa → se le repiten las opciones; la segunda vez queda en **Revisar** y te aviso.

Una reunión en **Revisar** pausa la secuencia hasta que pulses *Confirmar*, *Reactivar* o *Liberar cupo* en la app.

## Cómo funciona

```
Prospecto agenda (Appointment Schedule / Calendly) ─► Google Calendar del vendedor
                                                            ▲
App Next.js (Vercel) ── service account ────────────────────┘
   ▲  /api/motor/tick        (cada 5 min)  ◄── N8N 01 Motor ──────► Evolution API ─► WhatsApp
   ▲  /api/motor/respuesta   (cada mensaje) ◄── N8N 02 Respuestas ◄── webhook Evolution
```

- La lógica de etapas vive en `src/lib/core/sequence.ts` (pura, probada con `pnpm test`).
- N8N solo agenda las corridas y envía por Evolution los mensajes que la app le devuelve.
- Estado de cada reunión: `extendedProperties.private` del evento (`pf_estado`, `pf_telefono`, `pf_enviados`…).
- Configuración de cada vendedor: un evento técnico en su propio calendario el 1 ene 2000.

## Setup (una vez)

### 1. Google Cloud
1. Crea un proyecto y habilita **Google Calendar API**.
2. Crea una **service account** y descarga su clave JSON → `GOOGLE_SA_EMAIL` y `GOOGLE_SA_PRIVATE_KEY`.
3. Crea un **OAuth Client ID** (aplicación web) con redirect `https://TU-APP.vercel.app/api/auth/callback/google` (y `http://localhost:3000/api/auth/callback/google` para desarrollo) → `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`. En la pantalla de consentimiento agrega los emails de los vendedores como usuarios de prueba o publícala.

### 2. Vercel
Importa el repo, copia las variables de `.env.example` y despliega.

### 3. N8N
1. Credenciales → **Header Auth**:
   - `Prospección · x-motor-token`: name `x-motor-token`, value = `MOTOR_TOKEN`.
   - `Evolution · apikey`: name `apikey`, value = `EVOLUTION_API_KEY`.
2. Importa `n8n/01-motor.json` y `n8n/02-respuestas.json`.
3. En el nodo **Config** de cada flujo pon la URL de la app y la de Evolution API.
4. Asigna las credenciales en los nodos HTTP (vienen vacías al importar) y activa ambos flujos.
5. Copia la URL de producción del webhook de *02 Respuestas* a `N8N_RESPUESTAS_WEBHOOK_URL` en Vercel.

Para regenerar los JSON: `python3 scripts/gen-n8n.py` desde la raíz.

### 4. Cada vendedor
1. Su email va en `ALLOWED_EMAILS`.
2. Crea una **página de reservas** (Google Calendar → Agenda de citas) con el campo **teléfono obligatorio** y un título reconocible (p. ej. «Demo»). Calendly también sirve si escribe en el mismo calendario.
3. Entra a la app con Google y sigue el onboarding: compartir su calendario con el email de la service account con permiso «Hacer cambios en eventos».
4. En **Ajustes**: conecta su WhatsApp por QR, pon la palabra del título, su WhatsApp personal para avisos y activa la secuencia.

## Prueba de punta a punta
1. En /secuencia pon tiempos cortos: confirmación 1 h, insistencia 2 × cada 1 h… (o edita `pf_*` del evento técnico para minutos).
2. Agenda una reunión de prueba con tu propio número y verifica: bienvenida → confirmación → responde `1`, `2`, `3` o texto libre.
3. Revisa el estado en la pestaña Reuniones y las ejecuciones en N8N.

## Desarrollo
```bash
pnpm dev
pnpm test   # escenarios de la secuencia
pnpm lint
pnpm build
```

## Limitaciones conocidas
- El teléfono se lee de la descripción del evento; si no aparece, la reunión queda en Revisar.
- Los mensajes se marcan como enviados antes de que N8N los envíe: si Evolution falla, la reunión pasa a Revisar (no se reintenta solo).
- El webhook de N8N no exige token; cualquiera que conozca la URL y el número de un prospecto podría simular una respuesta.
