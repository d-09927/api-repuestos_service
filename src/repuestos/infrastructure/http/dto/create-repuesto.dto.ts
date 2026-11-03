import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CompatibilidadSchema = z
  .object({
    marca: z.string().trim().min(1).max(100),
    modelo: z.string().trim().min(1).max(100),
    anioDesde: z.number().int().min(1900).max(2100),
    anioHasta: z.number().int().min(1900).max(2100),
  })
  .strict();

export const CreateRepuestoSchema = z
  .object({
    sku: z.string().trim().min(1).max(50),
    /** Código universal del repuesto (PAS-DEL-CER). null o ausente si no tiene. */
    codigoUniversal: z.string().trim().min(1).max(50).nullable().optional(),
    nombre: z.string().trim().min(1).max(200),
    descripcion: z.string().optional(),
    marca: z.string().trim().min(1).max(100),
    categoria: z.string().trim().min(1).max(100),
    precio: z
      .number()
      .min(0)
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Máximo 2 decimales'),
    compatibilidad: z.array(CompatibilidadSchema).optional(),
  })
  .strict();

export class CreateRepuestoDto extends createZodDto(CreateRepuestoSchema) {}
