import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PaginacionSchema } from '../../../../common/paginacion';
import { Llamante } from '../../../domain/enums/llamante.enum';

/** Fecha AAAA-MM-DD (hora Colombia) o fecha-hora ISO completa. */
const fecha = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);

export const ListBitacoraQuerySchema = PaginacionSchema.extend({
  /** Nombre exacto de la herramienta: ?herramienta=consultar_precio_repuesto */
  herramienta: z.string().max(100).optional(),
  llamante: z.enum(Llamante).optional(),
  soloErrores: z.stringbool().optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
});

export class ListBitacoraQueryDto extends createZodDto(ListBitacoraQuerySchema) {}
