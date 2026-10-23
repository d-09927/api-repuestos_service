import { PaginaResultado } from '../../common/paginacion';
import { Movimiento } from '../domain/entities/movimiento.entity';
import { TipoMovimiento } from '../domain/enums/tipo-movimiento.enum';
import { MovimientoRepositoryPort } from '../domain/ports/movimiento.repository.port';
import { MovimientosService } from './movimientos.service';

class MovimientosEnMemoria extends MovimientoRepositoryPort {
  filas: Movimiento[] = [];
  filtros: unknown;
  async guardarVarios(m: Movimiento[]) {
    this.filas.push(...m);
  }
  async listar(f: unknown): Promise<PaginaResultado<Movimiento>> {
    this.filtros = f;
    return { items: this.filas, total: this.filas.length, pagina: 1, limite: 20 };
  }
}

describe('MovimientosService', () => {
  it('registra los movimientos limpiando motivo y referencia', async () => {
    const repo = new MovimientosEnMemoria();
    const service = new MovimientosService(repo);
    await service.registrar([
      {
        repuestoId: 'r-1',
        bodega: 'PRINCIPAL',
        tipo: TipoMovimiento.ENTRADA,
        cantidad: 3,
        cantidadResultante: 3,
        motivo: '  ',
        referencia: ' OC-001 ',
      },
    ]);
    expect(repo.filas).toHaveLength(1);
    expect(repo.filas[0].motivo).toBeNull();
    expect(repo.filas[0].referencia).toBe('OC-001');
    expect(repo.filas[0].id).toBeDefined();
  });

  it('normaliza la bodega al listar', async () => {
    const repo = new MovimientosEnMemoria();
    await new MovimientosService(repo).listar({ bodega: ' principal ', pagina: 1, limite: 20 });
    expect(repo.filtros).toMatchObject({ bodega: 'PRINCIPAL' });
  });
});
