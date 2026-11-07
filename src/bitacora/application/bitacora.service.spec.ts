import { PaginaResultado } from '../../common/paginacion';
import { LlamadaMcp } from '../domain/entities/llamada-mcp.entity';
import { Llamante } from '../domain/enums/llamante.enum';
import { FiltrosBitacora, LlamadaMcpRepositoryPort } from '../domain/ports/llamada-mcp.repository.port';
import { BitacoraService, MAX_RESULTADO } from './bitacora.service';

class BitacoraEnMemoria extends LlamadaMcpRepositoryPort {
  filas: LlamadaMcp[] = [];
  filtros: FiltrosBitacora | undefined;
  async guardar(l: LlamadaMcp) {
    this.filas.push(l);
  }
  async listar(f: FiltrosBitacora): Promise<PaginaResultado<LlamadaMcp>> {
    this.filtros = f;
    return { items: this.filas, total: this.filas.length, pagina: f.pagina, limite: f.limite };
  }
}

describe('BitacoraService', () => {
  it('registra la llamada con id, fecha y argumentos vacíos si no vienen', async () => {
    const repo = new BitacoraEnMemoria();
    await new BitacoraService(repo).registrar({
      llamante: Llamante.EXTERNO,
      herramienta: 'consultar_stock',
      resultado: '{"ok":true}',
      esError: false,
      duracionMs: 12.7,
    });
    expect(repo.filas).toHaveLength(1);
    expect(repo.filas[0]).toMatchObject({ argumentos: {}, duracionMs: 13, esError: false, resultado: '{"ok":true}' });
    expect(repo.filas[0].id).toBeDefined();
    expect(repo.filas[0].creadoEn).toBeInstanceOf(Date);
  });

  it('recorta los resultados muy largos', async () => {
    const repo = new BitacoraEnMemoria();
    await new BitacoraService(repo).registrar({
      llamante: Llamante.AGENTE,
      herramienta: 'catalogo_repuestos',
      resultado: 'x'.repeat(MAX_RESULTADO + 50),
      esError: false,
      duracionMs: 5,
    });
    expect(repo.filas[0].resultado!.length).toBeLessThan(MAX_RESULTADO + 60);
    expect(repo.filas[0].resultado).toContain('recortado');
  });

  it('convierte las fechas del filtro a días completos de Colombia', async () => {
    const repo = new BitacoraEnMemoria();
    await new BitacoraService(repo).listar({ herramienta: '  ', desde: '2026-11-05', hasta: '2026-11-05', pagina: 1, limite: 20 });
    expect(repo.filtros!.herramienta).toBeUndefined();
    expect(repo.filtros!.desde!.toISOString()).toBe('2026-11-05T05:00:00.000Z');
    expect(repo.filtros!.hasta!.getTime()).toBeGreaterThan(repo.filtros!.desde!.getTime());
  });
});
