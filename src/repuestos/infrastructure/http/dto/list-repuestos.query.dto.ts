import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PaginacionSchema } from '../../../../common/paginacion';

export const ListRepuestosQuerySchema = PaginacionSchema.extend({
  texto: z.string().optional(),
  marca: z.string().optional(),
  categoria: z.string().optional(),
  /** Filtro por vehículo: ?vehiculoMarca=Toyota&vehiculoModelo=Hilux&vehiculoAnio=2018 */
  vehiculoMarca: z.string().optional(),
  vehiculoModelo: z.string().optional(),
  vehiculoAnio: z.coerce.number().int().optional(),
  incluirInactivos: z.stringbool().optional(),
});

export class ListRepuestosQueryDto extends createZodDto(ListRepuestosQuerySchema) {}
