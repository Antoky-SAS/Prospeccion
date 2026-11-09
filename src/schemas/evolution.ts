import { z } from "zod";

export const EvolutionUpsertSchema = z.object({
  instance: z.string().min(1),
  data: z.object({
    key: z.object({
      remoteJid: z.string(),
      remoteJidAlt: z.string().optional(),
      senderPn: z.string().optional(),
      fromMe: z.boolean().optional(),
    }),
    senderPn: z.string().optional(),
    message: z
      .object({
        conversation: z.string().optional(),
        extendedTextMessage: z.object({ text: z.string().optional() }).optional(),
      })
      .nullish(),
  }),
});

export const FalloSchema = z.object({
  calendarId: z.string().min(1),
  eventId: z.string().min(1),
  etapa: z.string().optional(),
});
