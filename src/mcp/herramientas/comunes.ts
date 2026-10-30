import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { ConflictError, DomainError, NotFoundError } from '../../common/domain-error';

const logger = new Logger('MCP');

export const resultado = (datos: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(datos, null, 2) }],
});

// Un error de negocio se devuelve como resultado (isError), para que el modelo lo lea y
// corrija. Los errores inesperados no se muestran: se registran y se responde un mensaje genérico.
export const fallo = (error: unknown) => {
  let mensaje: string;
  if (error instanceof NotFoundError) mensaje = `No existe: ${error.message}`;
  else if (error instanceof ConflictError) mensaje = `Conflicto con las reglas del negocio: ${error.message}`;
  else if (error instanceof DomainError) mensaje = `Datos inválidos: ${error.message}`;
  else {
    logger.error((error as Error)?.stack ?? String(error));
    mensaje = 'Error inesperado en el servidor';
  }
  return { isError: true, content: [{ type: 'text' as const, text: mensaje }] };
};

export const seguro = async (accion: () => Promise<unknown>) => {
  try {
    return resultado(await accion());
  } catch (error) {
    return fallo(error);
  }
};

export const SOLO_LECTURA = { readOnlyHint: true, openWorldHint: false } as const;

export const id = (descripcion: string) => z.uuid().describe(descripcion);

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

export const paginar = (a: { pagina?: number; limite?: number }) => ({
  pagina: a.pagina ?? 1,
  limite: a.limite ?? 10,
});