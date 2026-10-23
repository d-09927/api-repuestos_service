import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateProveedorSchema = z
  .object({
    nit: z.string().trim().min(1).max(30),
    nombre: z.string().trim().min(1).max(200),
    contacto: z.string().max(150).optional(),
    telefono: z.string().max(30).optional(),
    email: z.email().max(150).optional(),
    direccion: z.string().max(250).optional(),
  })
  .strict();

export class CreateProveedorDto extends createZodDto(CreateProveedorSchema) {}
