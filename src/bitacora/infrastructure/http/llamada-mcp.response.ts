import { LlamadaMcp } from '../../domain/entities/llamada-mcp.entity';

export function toLlamadaMcpResponse(l: LlamadaMcp) {
  return {
    id: l.id,
    llamante: l.llamante,
    herramienta: l.herramienta,
    argumentos: l.argumentos,
    resultado: l.resultado,
    esError: l.esError,
    duracionMs: l.duracionMs,
    creadoEn: l.creadoEn,
  };
}
