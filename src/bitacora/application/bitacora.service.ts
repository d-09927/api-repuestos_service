import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { finDelDia, inicioDelDia } from '../../common/fechas';
import { PaginaResultado } from '../../common/paginacion';
import { LlamadaMcp } from '../domain/entities/llamada-mcp.entity';
import { LlamadaMcpRepositoryPort } from '../domain/ports/llamada-mcp.repository.port';
import { ListBitacoraQuery } from './dto/list-bitacora.query';
import { RegistrarLlamadaCommand } from './dto/registrar-llamada.command';

/** Hasta cuántos caracteres del resultado se guardan (el catálogo completo puede ser largo). */
export const MAX_RESULTADO = 20000;

/** Casos de uso de la bitácora del MCP: cada llamada a una herramienta deja un registro. */
@Injectable()
export class BitacoraService {
  constructor(private readonly llamadas: LlamadaMcpRepositoryPort) {}

  async registrar(c: RegistrarLlamadaCommand): Promise<void> {
    const resultado = c.resultado ?? null;
    await this.llamadas.guardar(
      new LlamadaMcp({
        id: randomUUID(),
        llamante: c.llamante,
        herramienta: c.herramienta,
        argumentos: c.argumentos ?? {},
        resultado:
          resultado && resultado.length > MAX_RESULTADO
            ? `${resultado.slice(0, MAX_RESULTADO)}… [recortado: ${resultado.length} caracteres]`
            : resultado,
        esError: c.esError,
        duracionMs: Math.max(0, Math.round(c.duracionMs)),
        creadoEn: new Date(),
      }),
    );
  }

  listar(query: ListBitacoraQuery): Promise<PaginaResultado<LlamadaMcp>> {
    return this.llamadas.listar({
      ...query,
      herramienta: query.herramienta?.trim() || undefined,
      desde: query.desde ? inicioDelDia(query.desde) : undefined,
      hasta: query.hasta ? finDelDia(query.hasta) : undefined,
    });
  }
}
