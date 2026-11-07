import { Logger } from '@nestjs/common';
import type { McpServer } from '@modelcontextprotocol/server';
import { BitacoraService } from '../bitacora/application/bitacora.service';
import { Llamante } from '../bitacora/domain/enums/llamante.enum';

const logger = new Logger('Bitacora');

type Manejador = (...args: unknown[]) => unknown;
type Registrar = (nombre: string, config: { inputSchema?: unknown }, manejador: Manejador) => unknown;

/** El texto que devolvió la herramienta (lo mismo que lee el que llamó). */
function textoDe(respuesta: unknown): string | null {
  const contenido = (respuesta as { content?: { type: string; text?: string }[] } | undefined)?.content;
  if (!Array.isArray(contenido)) return null;
  return contenido.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n') || null;
}

/**
 * Hace que cada herramienta que se registre en este servidor deje su llamada en la bitácora
 * (quién, qué herramienta, argumentos, resultado, error y duración). Se llama antes de registrar
 * las herramientas. Guardar el registro nunca hace fallar ni demora la respuesta.
 */
export function conBitacora(servidor: McpServer, bitacora: BitacoraService, llamante: Llamante): McpServer {
  const original = (servidor.registerTool as unknown as Registrar).bind(servidor);
  const registrar: Registrar = (nombre, config, manejador) =>
    original(nombre, config, async (...args: unknown[]) => {
      const inicio = performance.now();
      // Con inputSchema el manejador recibe (argumentos, ctx); sin él, solo (ctx).
      const argumentos = config.inputSchema && args.length > 1 ? (args[0] as Record<string, unknown>) : {};
      let respuesta: unknown;
      let excepcion: unknown;
      try {
        respuesta = await manejador(...args);
        return respuesta;
      } catch (error) {
        excepcion = error;
        throw error;
      } finally {
        const esError = excepcion !== undefined || (respuesta as { isError?: boolean } | undefined)?.isError === true;
        bitacora
          .registrar({
            llamante,
            herramienta: nombre,
            argumentos,
            resultado: excepcion !== undefined ? String((excepcion as Error)?.message ?? excepcion) : textoDe(respuesta),
            esError,
            duracionMs: performance.now() - inicio,
          })
          .catch((e: unknown) => logger.error(`No se pudo guardar la llamada a ${nombre}: ${(e as Error)?.message ?? e}`));
      }
    });
  (servidor as unknown as { registerTool: Registrar }).registerTool = registrar;
  return servidor;
}
