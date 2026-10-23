import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { TipoDocumento } from '../../../domain/enums/tipo-documento.enum';

export const CreateClienteSchema = z
  .object({
    tipoDocumento: z.enum(TipoDocumento),
    documento: z.string().trim().min(1).max(30),
    nombre: z.string().trim().min(1).max(200),
    telefono: z.string().max(30).optional(),
    email: z.email().max(150).optional(),
    direccion: z.string().max(250).optional(),
  })
  .strict();

export class CreateClienteDto extends createZodDto(CreateClienteSchema) {}
