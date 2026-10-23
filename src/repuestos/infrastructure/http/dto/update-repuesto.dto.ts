import { createZodDto } from 'nestjs-zod';
import { CreateRepuestoSchema } from './create-repuesto.dto';

/** Igual que crear, pero todo opcional y sin SKU (el SKU no se cambia). */
export const UpdateRepuestoSchema = CreateRepuestoSchema.omit({ sku: true }).partial();

export class UpdateRepuestoDto extends createZodDto(UpdateRepuestoSchema) {}
