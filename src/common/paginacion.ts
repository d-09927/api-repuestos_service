import { z } from 'zod';

export interface PaginaResultado<T> {
  items: T[];
  total: number;
  pagina: number;
  limite: number;
}

/** Parámetros ?pagina=1&limite=20 reutilizables en cualquier listado. */
export const PaginacionSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});
