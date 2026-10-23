import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Base común de entradas, salidas, reservas y liberaciones. */
const movimientoBase = {
  repuestoId: z.uuid(),
  bodega: z.string().trim().min(1).max(50),
  cantidad: z.number().int().positive(),
  motivo: z.string().max(200).optional(),
  /** Documento de origen: orden de compra, orden de taller, factura... */
  referencia: z.string().max(100).optional(),
};

export const MovimientoStockSchema = z.object(movimientoBase).strict();

export const EntradaStockSchema = z
  .object({
    ...movimientoBase,
    /** Stock mínimo de alerta para este repuesto en esta bodega. */
    minimo: z.number().int().min(0).optional(),
    ubicacion: z.string().max(100).optional(),
  })
  .strict();

export const SalidaStockSchema = z
  .object({
    ...movimientoBase,
    /** true si lo que se entrega ya estaba reservado. */
    desdeReserva: z.boolean().optional(),
  })
  .strict();

export const AjusteStockSchema = z
  .object({
    repuestoId: z.uuid(),
    bodega: z.string().trim().min(1).max(50),
    cantidadNueva: z.number().int().min(0),
    motivo: z.string().trim().min(1).max(200),
    referencia: z.string().max(100).optional(),
  })
  .strict();

export class MovimientoStockDto extends createZodDto(MovimientoStockSchema) {}
export class EntradaStockDto extends createZodDto(EntradaStockSchema) {}
export class SalidaStockDto extends createZodDto(SalidaStockSchema) {}
export class AjusteStockDto extends createZodDto(AjusteStockSchema) {}
