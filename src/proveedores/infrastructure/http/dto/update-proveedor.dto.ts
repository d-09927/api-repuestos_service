import { createZodDto } from 'nestjs-zod';
import { CreateProveedorSchema } from './create-proveedor.dto';

/** Igual que crear, pero todo opcional y sin NIT (el NIT no se cambia). */
export const UpdateProveedorSchema = CreateProveedorSchema.omit({ nit: true }).partial().strict();

export class UpdateProveedorDto extends createZodDto(UpdateProveedorSchema) {}
