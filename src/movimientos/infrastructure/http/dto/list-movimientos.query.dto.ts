import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PaginacionSchema } from '../../../../common/paginacion';

export const ListMovimientosQuerySchema = PaginacionSchema.extend({
  repuestoId: z.uuid().optional(),
  bodega: z.string().optional(),
});

export class ListMovimientosQueryDto extends createZodDto(ListMovimientosQuerySchema) {}
