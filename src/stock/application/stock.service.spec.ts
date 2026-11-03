import { UnidadDeTrabajoPort } from '../../common/unidad-de-trabajo/unidad-de-trabajo.port';
import { StockItem } from '../domain/entities/stock-item.entity';
import { StockInsuficienteError } from '../domain/errors/stock-insuficiente.error';
import { MovimientoServicePort, RegistroMovimiento } from '../domain/ports/movimiento.service.port';
import { RepuestoDelCatalogo, RepuestoServicePort } from '../domain/ports/repuesto.service.port';
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
  async listarConDisponible() {
    return [...this.filas.values()].filter((s) => s.cantidad - s.reservada > 0);
  }
}

class MovimientosFalsos extends MovimientoServicePort {
  registrados: RegistroMovimiento[] = [];
  async registrar(m: RegistroMovimiento[]) {
    this.registrados.push(...m);
  }
}

class RepuestosFalsos extends RepuestoServicePort {
  /** Los activos que conoce el catálogo; los demás ids se toman como inexistentes o desactivados. */
  activos: RepuestoDelCatalogo[] = [];
  async verificarRepuestoActivo() {}
  async activosPorIds(ids: string[]) {
    return this.activos.filter((r) => ids.includes(r.id));
  }
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
  let repuestos: RepuestosFalsos;

  beforeEach(() => {
    stocks = new StockEnMemoria();
    movimientos = new MovimientosFalsos();
    repuestos = new RepuestosFalsos();
    service = new StockService(stocks, movimientos, repuestos, new SinTransaccion());
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

  describe('lotes de un pedido (reservar, entregar desde la reserva, liberar)', () => {
    const B = '22222222-2222-2222-2222-222222222222';
    const lote = (lineas: { repuestoId: string; cantidad: number }[], extra = {}) => ({
      bodega: 'principal',
      referencia: 'OT-0054',
      motivo: 'Pedido',
      lineas,
      ...extra,
    });
    const item = async (id: string) => (await stocks.bloquear(id, 'PRINCIPAL'))!;

    beforeEach(async () => {
      await entrada(5);
      await service.registrarEntrada({ repuestoId: B, bodega: 'PRINCIPAL', cantidad: 3 });
    });

    it('reserva varias líneas y deja el movimiento con la referencia de la orden', async () => {
      await service.reservarVarios(lote([{ repuestoId: REPUESTO, cantidad: 2 }, { repuestoId: B, cantidad: 3 }]));

      expect((await item(REPUESTO)).reservada).toBe(2);
      expect((await item(B)).reservada).toBe(3);
      expect(movimientos.registrados.at(-1)).toMatchObject({ tipo: 'RESERVA', referencia: 'OT-0054' });
    });

    it('reservar es todo o nada', async () => {
      await expect(
        service.reservarVarios(lote([{ repuestoId: REPUESTO, cantidad: 2 }, { repuestoId: B, cantidad: 4 }])),
      ).rejects.toThrow(StockInsuficienteError);
      expect((await item(REPUESTO)).reservada).toBe(0);
    });

    it('una salida desde la reserva baja lo físico y lo reservado, no lo disponible de otros', async () => {
      await service.reservarVarios(lote([{ repuestoId: REPUESTO, cantidad: 2 }]));

      await service.registrarSalidas(lote([{ repuestoId: REPUESTO, cantidad: 2 }], { desdeReserva: true }));

      expect(await item(REPUESTO)).toMatchObject({ cantidad: 3, reservada: 0 });
    });

    it('no se entrega desde la reserva más de lo reservado', async () => {
      await service.reservarVarios(lote([{ repuestoId: REPUESTO, cantidad: 1 }]));

      await expect(
        service.registrarSalidas(lote([{ repuestoId: REPUESTO, cantidad: 2 }], { desdeReserva: true })),
      ).rejects.toThrow('reservada');
    });

    it('liberar varias líneas devuelve lo reservado a disponible', async () => {
      await service.reservarVarios(lote([{ repuestoId: REPUESTO, cantidad: 2 }, { repuestoId: B, cantidad: 1 }]));

      await service.liberarVarios(lote([{ repuestoId: REPUESTO, cantidad: 2 }, { repuestoId: B, cantidad: 1 }]));

      expect((await item(REPUESTO)).reservada).toBe(0);
      expect((await item(B)).reservada).toBe(0);
    });
  });

  describe('catálogo', () => {
    const repuesto = (id: string, codigoUniversal: string | null, marca: string, precio: number, categoria = 'Frenos') => ({
      id,
      codigoUniversal,
      nombre: `Juego de pastillas delanteras ${marca}`,
      marca,
      categoria,
      precio,
    });
    const BOSCH = '00000000-0000-0000-0000-00000000000b';
    const BREMBO = '00000000-0000-0000-0000-0000000000b2';
    const FILTRO = '00000000-0000-0000-0000-0000000000f1';

    beforeEach(async () => {
      repuestos.activos = [
        repuesto(BOSCH, 'PAS-DEL-CER', 'Bosch', 172050),
        repuesto(BREMBO, 'PAS-DEL-CER', 'Brembo', 189000),
        { ...repuesto(FILTRO, 'FIL-ACE', 'Mann', 30000, 'Filtros'), nombre: 'Filtro de aceite Mann' },
      ];
      await service.registrarEntrada({ repuestoId: BOSCH, bodega: 'PRINCIPAL', cantidad: 8 });
      await service.registrarEntrada({ repuestoId: BREMBO, bodega: 'PRINCIPAL', cantidad: 3 });
      await service.registrarEntrada({ repuestoId: BREMBO, bodega: 'NORTE', cantidad: 2 });
      await service.registrarEntrada({ repuestoId: FILTRO, bodega: 'NORTE', cantidad: 5 });
    });

    it('lista cada código universal una sola vez, sumando marcas y bodegas y con el precio de la más barata', async () => {
      await service.reservar({ repuestoId: BOSCH, bodega: 'PRINCIPAL', cantidad: 2 });

      expect(await service.catalogo()).toEqual([
        {
          codigoUniversal: 'FIL-ACE',
          nombre: 'Filtro de aceite',
          categoria: 'Filtros',
          marcas: ['Mann'],
          unidadesDisponibles: 5,
          precioDesde: 30000,
          bodegas: ['NORTE'],
        },
        {
          codigoUniversal: 'PAS-DEL-CER',
          nombre: 'Juego de pastillas delanteras',
          categoria: 'Frenos',
          marcas: ['Bosch', 'Brembo'],
          // 6 de Bosch (8 menos 2 reservadas) + 5 de Brembo
          unidadesDisponibles: 11,
          precioDesde: 172050,
          bodegas: ['NORTE', 'PRINCIPAL'],
        },
      ]);
    });

    it('no incluye lo agotado o reservado, lo desactivado ni lo que no tiene código universal', async () => {
      await service.reservar({ repuestoId: BOSCH, bodega: 'PRINCIPAL', cantidad: 8 });
      await service.registrarEntrada({ repuestoId: REPUESTO, bodega: 'PRINCIPAL', cantidad: 4 }); // desactivado
      repuestos.activos.push(repuesto('00000000-0000-0000-0000-0000000000c0', null, 'Genérica', 1000));
      await service.registrarEntrada({ repuestoId: '00000000-0000-0000-0000-0000000000c0', bodega: 'PRINCIPAL', cantidad: 4 });

      const catalogo = await service.catalogo();

      expect(catalogo.map((i) => i.codigoUniversal)).toEqual(['FIL-ACE', 'PAS-DEL-CER']);
      expect(catalogo[1]).toMatchObject({ marcas: ['Brembo'], unidadesDisponibles: 5, precioDesde: 189000 });
    });

    it('filtra por categoría sin importar mayúsculas', async () => {
      expect((await service.catalogo(' frenos ')).map((i) => i.codigoUniversal)).toEqual(['PAS-DEL-CER']);
    });
  });
});
