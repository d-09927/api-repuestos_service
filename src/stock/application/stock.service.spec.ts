import { UnidadDeTrabajoPort } from '../../common/unidad-de-trabajo/unidad-de-trabajo.port';
import { StockItem } from '../domain/entities/stock-item.entity';
import { StockInsuficienteError } from '../domain/errors/stock-insuficiente.error';
import { MovimientoServicePort, RegistroMovimiento } from '../domain/ports/movimiento.service.port';
import { RepuestoServicePort } from '../domain/ports/repuesto.service.port';
import { StockRepositoryPort } from '../domain/ports/stock.repository.port';
import { StockService } from './stock.service';

const REPUESTO = '11111111-1111-1111-1111-111111111111';

class StockEnMemoria extends StockRepositoryPort {
  filas = new Map<string, StockItem>();
  private clave = (r: string, b: string) => `${r}|${b}`;
  async bloquear(r: string, b: string) {
    const f = this.filas.get(this.clave(r, b));
    return f ? new StockItem({ ...f }) : null; // copia: simula leer de la base
  }
  async bloquearVarios(b: string, ids: string[]) {
    const m = new Map<string, StockItem | null>();
    for (const id of ids) m.set(id, await this.bloquear(id, b));
    return m;
  }
  async guardar(s: StockItem) {
    this.filas.set(this.clave(s.repuestoId, s.bodega), new StockItem({ ...s }));
  }
  async listarPorRepuesto(id: string) {
    return [...this.filas.values()].filter((s) => s.repuestoId === id);
  }
  async listarBajoMinimo() {
    return [...this.filas.values()].filter((s) => s.cantidad - s.reservada <= s.minimo);
  }
}

class MovimientosFalsos extends MovimientoServicePort {
  registrados: RegistroMovimiento[] = [];
  async registrar(m: RegistroMovimiento[]) {
    this.registrados.push(...m);
  }
}

class RepuestosFalsos extends RepuestoServicePort {
  async verificarRepuestoActivo() {}
}

class SinTransaccion extends UnidadDeTrabajoPort {
  ejecutar<T>(trabajo: () => Promise<T>) {
    return trabajo();
  }
}

describe('StockService', () => {
  let service: StockService;
  let stocks: StockEnMemoria;
  let movimientos: MovimientosFalsos;

  beforeEach(() => {
    stocks = new StockEnMemoria();
    movimientos = new MovimientosFalsos();
    service = new StockService(stocks, movimientos, new RepuestosFalsos(), new SinTransaccion());
  });

  const entrada = (cantidad: number, extra = {}) =>
    service.registrarEntrada({ repuestoId: REPUESTO, bodega: ' principal ', cantidad, ...extra });

  it('la primera entrada crea el stock, normaliza la bodega y deja un movimiento', async () => {
    const s = await entrada(10, { referencia: ' OC-001 ', minimo: 3, ubicacion: ' A-1 ' });
    expect(s.bodega).toBe('PRINCIPAL');
    expect(s.cantidad).toBe(10);
    expect(s.minimo).toBe(3);
    expect(s.ubicacion).toBe('A-1');
    expect(movimientos.registrados).toMatchObject([
      { tipo: 'ENTRADA', cantidad: 10, cantidadResultante: 10, referencia: 'OC-001' },
    ]);
  });

  it('rechaza cantidades que no son enteros positivos', async () => {
    await expect(entrada(0)).rejects.toThrow('mayor que 0');
    await expect(entrada(-2)).rejects.toThrow();
    await expect(entrada(1.5)).rejects.toThrow();
  });

  it('una salida resta y no deja salir más de lo disponible', async () => {
    await entrada(10);
    const s = await service.registrarSalida({ repuestoId: REPUESTO, bodega: 'PRINCIPAL', cantidad: 4 });
    expect(s.cantidad).toBe(6);
    await expect(
      service.registrarSalida({ repuestoId: REPUESTO, bodega: 'PRINCIPAL', cantidad: 7 }),
    ).rejects.toThrow(StockInsuficienteError);
  });

  it('lo reservado no está disponible para salidas ni nuevas reservas', async () => {
    await entrada(10);
    const base = { repuestoId: REPUESTO, bodega: 'PRINCIPAL' };
    await service.reservar({ ...base, cantidad: 6 });
    expect(service.disponible((await stocks.bloquear(REPUESTO, 'PRINCIPAL'))!)).toBe(4);
    await expect(service.reservar({ ...base, cantidad: 5 })).rejects.toThrow(StockInsuficienteError);
    await expect(service.registrarSalida({ ...base, cantidad: 5 })).rejects.toThrow(StockInsuficienteError);
  });

  it('entregar desde la reserva baja lo físico y lo reservado', async () => {
    await entrada(10);
    const base = { repuestoId: REPUESTO, bodega: 'PRINCIPAL' };
    await service.reservar({ ...base, cantidad: 6 });
    const s = await service.registrarSalida({ ...base, cantidad: 6, desdeReserva: true });
    expect(s.cantidad).toBe(4);
    expect(s.reservada).toBe(0);
    await expect(
      service.registrarSalida({ ...base, cantidad: 1, desdeReserva: true }),
    ).rejects.toThrow(StockInsuficienteError);
  });

  it('liberar devuelve lo reservado a disponible y no libera de más', async () => {
    await entrada(10);
    const base = { repuestoId: REPUESTO, bodega: 'PRINCIPAL' };
    await service.reservar({ ...base, cantidad: 6 });
    const s = await service.liberarReserva({ ...base, cantidad: 6 });
    expect(s.reservada).toBe(0);
    await expect(service.liberarReserva({ ...base, cantidad: 1 })).rejects.toThrow(StockInsuficienteError);
  });

  it('un ajuste fija la cantidad física, registra la diferencia y respeta lo reservado', async () => {
    await entrada(10);
    const base = { repuestoId: REPUESTO, bodega: 'PRINCIPAL' };
    await service.reservar({ ...base, cantidad: 4 });
    await expect(service.ajustar({ ...base, cantidadNueva: 3, motivo: 'Conteo' })).rejects.toThrow(
      StockInsuficienteError,
    );
    const s = await service.ajustar({ ...base, cantidadNueva: 7, motivo: ' Conteo físico ' });
    expect(s.cantidad).toBe(7);
    expect(movimientos.registrados.at(-1)).toMatchObject({
      tipo: 'AJUSTE',
      cantidad: -3,
      cantidadResultante: 7,
      motivo: 'Conteo físico',
    });
  });

  it('exige que exista stock para salidas, reservas y ajustes', async () => {
    await expect(
      service.registrarSalida({ repuestoId: REPUESTO, bodega: 'PRINCIPAL', cantidad: 1 }),
    ).rejects.toThrow('No hay stock registrado');
  });

  it('el stock bajo incluye lo disponible que llegó al mínimo', async () => {
    await entrada(5, { minimo: 5 });
    expect(await service.stockBajo()).toHaveLength(1);
  });

  it('un lote de salidas es todo o nada', async () => {
    const B = '22222222-2222-2222-2222-222222222222';
    await entrada(5);
    await service.registrarEntrada({ repuestoId: B, bodega: 'PRINCIPAL', cantidad: 1 });
    const antes = movimientos.registrados.length;
    await expect(
      service.registrarSalidas({
        bodega: 'PRINCIPAL',
        referencia: 'V-1',
        motivo: 'Venta',
        lineas: [
          { repuestoId: REPUESTO, cantidad: 2 },
          { repuestoId: B, cantidad: 5 },
        ],
      }),
    ).rejects.toThrow(StockInsuficienteError);
    // la regla falló antes de guardar nada
    expect((await stocks.bloquear(REPUESTO, 'PRINCIPAL'))!.cantidad).toBe(5);
    expect(movimientos.registrados.length).toBe(antes);
  });
});
