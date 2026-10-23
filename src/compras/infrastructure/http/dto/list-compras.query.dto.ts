import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PaginacionSchema } from '../../../../common/paginacion';

/** Fecha AAAA-MM-DD (hora Colombia) o fecha-hora ISO completa. */
const fecha = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);

export const ListComprasQuerySchema = PaginacionSchema.extend({
  proveedorId: z.uuid().optional(),
  /** Desde esta fecha. */
  desde: fecha.optional(),
  /** Hasta esta fecha, incluyendo todo ese día si solo se indica AAAA-MM-DD. */
  hasta: fecha.optional(),
});

export class ListComprasQueryDto extends createZodDto(ListComprasQuerySchema) {}
