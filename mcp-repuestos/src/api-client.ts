import { config } from './config.js';

/** La API respondió con un error (4xx/5xx). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detalle: unknown,
  ) {
    super(`La API respondió ${status}`);
  }
}

/** No se pudo hablar con la API (apagada, puerto equivocado, timeout...). */
export class ApiNoDisponibleError extends Error {}

type Query = Record<string, string | number | boolean | undefined>;

interface Opciones {
  query?: Query;
  body?: unknown;
}

/** Único punto que habla HTTP con la API de repuestos. Las herramientas no usan fetch directamente. */
export async function api<T = unknown>(
  metodo: 'GET' | 'POST',
  ruta: string,
  { query, body }: Opciones = {},
): Promise<T> {
  const url = new URL(config.apiUrl + ruta);
  for (const [clave, valor] of Object.entries(query ?? {})) {
    if (valor !== undefined && valor !== '') url.searchParams.set(clave, String(valor));
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: metodo,
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new ApiNoDisponibleError(
      `No se pudo conectar con la API de repuestos en ${config.apiUrl} (${(error as Error).message})`,
    );
  }

  const texto = await respuesta.text();
  let datos: unknown = texto;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    /* respuesta no JSON: se deja el texto */
  }

  if (!respuesta.ok) throw new ApiError(respuesta.status, datos);
  return datos as T;
}
