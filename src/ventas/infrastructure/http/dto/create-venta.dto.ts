import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** El precio no se envía: se toma del catálogo en el momento de la venta. */
export const LineaVentaSchema = z
  .object({
    repuestoId: z.uuid(),
    cantidad: z.number().int().positive(),
  })
  .strict();

export const CreateVentaSchema = z
  .object({
    /** Opcional: una venta de mostrador puede no tener cliente. */
    clienteId: z.uuid().optional(),
    /** VIN del vehículo al que va el repuesto: 17 caracteres, sin I, O ni Q. */
    vin: z.string().max(30).optional(),
    /** Bodega de la que salen los repuestos. Si no se indica, PRINCIPAL. */
    bodega: z.string().max(50).optional(),
    observaciones: z.string().max(500).optional(),
    lineas: z.array(LineaVentaSchema).min(1),
  })
  .strict();

export class CreateVentaDto extends createZodDto(CreateVentaSchema) {}
