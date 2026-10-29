import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ApiError, ApiNoDisponibleError } from './api-client.js';

const MAX_CARACTERES = 30_000;

/** Respuesta correcta de una herramienta: el dato como JSON legible. */
export function ok(datos: unknown): CallToolResult {
  let texto = JSON.stringify(datos, null, 2);
  if (texto.length > MAX_CARACTERES) {
    texto = texto.slice(0, MAX_CARACTERES) + '\n... (recortado: usa filtros o una página más pequeña)';
  }
  return { content: [{ type: 'text', text: texto }] };
}

export function fallo(mensaje: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: mensaje }] };
}

/**
 * Ejecuta una herramienta y convierte los errores en un resultado con isError,
 * para que el modelo los lea y pueda corregirse (en vez de romper el protocolo).
 */
export async function conManejo(accion: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return ok(await accion());
  } catch (error) {
    if (error instanceof ApiError) {
      const cuerpo = error.detalle as { message?: unknown } | null;
      const mensaje =
        typeof cuerpo?.message === 'string' ? cuerpo.message : JSON.stringify(cuerpo?.message ?? cuerpo);
      const causa: Record<number, string> = {
        400: 'Datos inválidos',
        404: 'No existe',
        409: 'Conflicto con las reglas del negocio',
      };
      return fallo(`${causa[error.status] ?? `Error ${error.status}`}: ${mensaje}`);
    }
    if (error instanceof ApiNoDisponibleError) return fallo(error.message);
    return fallo(`Error inesperado: ${(error as Error).message}`);
  }
}
