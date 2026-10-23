import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PaginacionSchema } from '../../../../common/paginacion';

export const ListClientesQuerySchema = PaginacionSchema.extend({
  texto: z.string().optional(),
  incluirInactivos: z.stringbool().optional(),
});

export class ListClientesQueryDto extends createZodDto(ListClientesQuerySchema) {}
