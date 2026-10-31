import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const MensajeSchema = z
  .object({
    texto: z.string().trim().min(1).max(2000).describe('Lo que escribe el cliente'),
    conversacionId: z
      .uuid()
      .optional()
      .describe('Para continuar una conversación: el conversacionId de la respuesta anterior. Sin él empieza una nueva.'),
  })
  .strict();

export class MensajeDto extends createZodDto(MensajeSchema) {}
