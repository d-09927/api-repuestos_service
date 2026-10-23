import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const LineaCompraSchema = z
  .object({
    repuestoId: z.uuid(),
    cantidad: z.number().int().positive(),
    costoUnitario: z
      .number()
      .min(0)
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Máximo 2 decimales'),
  })
  .strict();

export const CreateCompraSchema = z
  .object({
    proveedorId: z.uuid(),
    /** Bodega donde entra la mercancía. Si no se indica, PRINCIPAL. */
    bodega: z.string().max(50).optional(),
    /** Número de la factura del proveedor. */
    numeroFacturaProveedor: z.string().max(60).optional(),
    observaciones: z.string().max(500).optional(),
    lineas: z.array(LineaCompraSchema).min(1),
  })
  .strict();

export class CreateCompraDto extends createZodDto(CreateCompraSchema) {}
