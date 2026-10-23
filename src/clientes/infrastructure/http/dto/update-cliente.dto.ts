import { createZodDto } from 'nestjs-zod';
import { CreateClienteSchema } from './create-cliente.dto';

/** Igual que crear, pero todo opcional y sin tipo/número de documento (no se cambian). */
export const UpdateClienteSchema = CreateClienteSchema.omit({ tipoDocumento: true, documento: true })
  .partial()
  .strict();

export class UpdateClienteDto extends createZodDto(UpdateClienteSchema) {}
