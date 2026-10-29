import { z } from 'zod';

export const uuid = (descripcion: string) => z.string().uuid().describe(descripcion);

export const fechaDia = (descripcion: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato AAAA-MM-DD')
    .describe(`${descripcion} Formato AAAA-MM-DD (hora de Colombia).`);

/** Paginación común. Por defecto 10 resultados para no saturar al modelo. */
export const paginacion = {
  pagina: z.number().int().min(1).optional().describe('Página (empieza en 1).'),
  limite: z.number().int().min(1).max(50).optional().describe('Resultados por página (máx. 50, por defecto 10).'),
};

export function paginar(args: { pagina?: number; limite?: number }) {
  return { pagina: args.pagina ?? 1, limite: args.limite ?? 10 };
}

export const SOLO_LECTURA = { readOnlyHint: true, openWorldHint: false } as const;
