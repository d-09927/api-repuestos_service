import { PaginaResultado } from '../../common/paginacion';
import { UnidadDeTrabajoPort } from '../../common/unidad-de-trabajo/unidad-de-trabajo.port';
import { Venta } from '../domain/entities/venta.entity';
import {
  VentaDetalleServicePort,
  DetalleVentaInfo,
  LineaVentaInfo,
} from '../domain/ports/venta-detalle.service.port';
import { VentaRepositoryPort } from '../domain/ports/venta.repository.port';
import { ClienteServicePort } from '../domain/ports/cliente.service.port';
import { RepuestoInfo, RepuestoServicePort } from '../domain/ports/repuesto.service.port';
import { MovimientoDeVenta, StockServicePort } from '../domain/ports/stock.service.port';
import { VentasService } from './ventas.service';

const CLIENTE = '11111111-1111-4111-8111-111111111111';
const R1 = '22222222-2222-4222-8222-222222222222';

class VentasEnMemoria extends VentaRepositoryPort {
  filas: Venta[] = [];
  falla = false;
  private n = 0;
  async siguienteConsecutivo() {
    return ++this.n;
  }
  async guardar(c: Venta) {
    if (this.falla) throw new Error('base caída');
    this.filas.push(c);
  }
  async buscarPorId(id: string) {
    return this.filas.find((c) => c.id === id) ?? null;
  }
  async listar(): Promise<PaginaResultado<Venta>> {
    return { items: this.filas, total: this.filas.length, pagina: 1, limite: 20 };
  }
  async listarPorVin(vin: string) {
    return this.filas.filter((v) => v.vin === vin).sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }
}

class DetallesFalsos extends VentaDetalleServicePort {
  filas: DetalleVentaInfo[] = [];
  construir(lineas: LineaVentaInfo[]) {
    return lineas.map((l, i) => ({ ...l, id: `d-${i}`, subtotal: l.cantidad * l.precioUnitario }));
  }
  async guardar(d: DetalleVentaInfo[]) {
    this.filas.push(...d);
  }
  async listarPorVentas(ids: string[]) {
    return this.filas.filter((d) => ids.includes(d.ventaId));
  }
}

class ClientesFalsos extends ClienteServicePort {
  async verificarClienteActivo() {}
}

class RepuestosFalsos extends RepuestoServicePort {
  codigo: string | null = 'FIL-ACE-STD';
  categoria = 'Filtros';
  async obtenerActivos(ids: string[]): Promise<RepuestoInfo[]> {
    return ids.map((id) => ({ id, sku: 'SKU-1', nombre: 'Filtro', codigoUniversal: this.codigo, categoria: this.categoria, precio: 10 }));
  }
}

class StockFalso extends StockServicePort {
  descuentos: MovimientoDeVenta[] = [];
  reversiones: MovimientoDeVenta[] = [];
  async descontarMercancia(m: MovimientoDeVenta) {
    this.descuentos.push(m);
  }
  async revertirDescuento(m: MovimientoDeVenta) {
    this.reversiones.push(m);
  }
}

class SinTransaccion extends UnidadDeTrabajoPort {
  ejecutar<T>(trabajo: () => Promise<T>) {
    return trabajo();
  }
}

describe('VentasService', () => {
  let ventas: VentasEnMemoria;
  let detalles: DetallesFalsos;
  let stock: StockFalso;
  let service: VentasService;

  beforeEach(() => {
    ventas = new VentasEnMemoria();
    detalles = new DetallesFalsos();
    stock = new StockFalso();
    service = new VentasService(
      ventas,
      detalles,
      new ClientesFalsos(),
      new RepuestosFalsos(),
      stock,
      new SinTransaccion(),
    );
  });

  const comando = { clienteId: CLIENTE, lineas: [{ repuestoId: R1, cantidad: 3 }] };

  it('registra la venta con número, total (con el precio del catálogo), bodega por defecto y sus líneas', async () => {
    const { venta, detalles: lineas } = await service.registrar(comando);
    expect(venta.numero).toBe('V-000001');
    expect(venta.total).toBe(30);
    expect(venta.bodega).toBe('PRINCIPAL');
    expect(lineas).toHaveLength(1);
    expect(detalles.filas).toHaveLength(1);
  });

  it('numera con ceros a la izquierda y normaliza la bodega y los textos', async () => {
    await service.registrar(comando);
    const { venta } = await service.registrar({
      ...comando,
      bodega: ' taller ',
      observaciones: '  ',
    });
    expect(venta.numero).toBe('V-000002');
    expect(venta.bodega).toBe('TALLER');
    expect(venta.observaciones).toBeNull();
  });

  it('descuenta las unidades del stock usando el número de venta como referencia', async () => {
    await service.registrar(comando);
    expect(stock.descuentos).toEqual([
      { bodega: 'PRINCIPAL', referencia: 'V-000001', lineas: [{ repuestoId: R1, cantidad: 3 }] },
    ]);
  });

  it('si no se puede guardar la venta, devuelve el stock', async () => {
    ventas.falla = true;
    await expect(service.registrar(comando)).rejects.toThrow('base caída');
    expect(stock.reversiones).toHaveLength(1);
    expect(stock.reversiones[0].referencia).toBe('V-000001');
  });

  it('el cliente es opcional (venta de mostrador)', async () => {
    const { venta } = await service.registrar({ lineas: comando.lineas });
    expect(venta.clienteId).toBeNull();
  });

  it('responde 404 si la venta no existe', async () => {
    await expect(service.obtener('no-existe')).rejects.toThrow('No existe la venta');
  });

  describe('estado de pago', () => {
    it('una venta de mostrador queda pagada en el momento', async () => {
      const { venta } = await service.registrar(comando);
      expect(venta.estado).toBe('PAGADA');
      expect(venta.pagadaEn).toEqual(venta.fecha);
      expect(stock.descuentos[0].desdeReserva).toBeUndefined();
    });

    it('la de un pedido queda por cobrar y saca las unidades de lo reservado', async () => {
      const { venta } = await service.registrar(comando, { pendienteDePago: true, desdeReserva: true });
      expect(venta.estado).toBe('PENDIENTE_PAGO');
      expect(venta.pagadaEn).toBeNull();
      expect(stock.descuentos[0].desdeReserva).toBe(true);
    });

    it('marcarPagada guarda la referencia; una venta ya pagada no se vuelve a pagar', async () => {
      const { venta } = await service.registrar(comando, { pendienteDePago: true });

      const pagada = await service.marcarPagada(venta.id, ' PSE-123 ');
      expect(pagada).toMatchObject({ estado: 'PAGADA', referenciaPago: 'PSE-123' });
      expect(pagada.pagadaEn).toBeInstanceOf(Date);

      await expect(service.marcarPagada(venta.id, 'PSE-124')).rejects.toThrow('ya está pagada');
    });

    it('exige la referencia del pago', async () => {
      const { venta } = await service.registrar(comando, { pendienteDePago: true });
      await expect(service.marcarPagada(venta.id, '  ')).rejects.toThrow('referencia del pago');
    });
  });

  describe('VIN y garantía', () => {
    const VIN = '3MZBP2SM1SM600006';
    let repuestos: RepuestosFalsos;

    beforeEach(() => {
      repuestos = new RepuestosFalsos();
      service = new VentasService(ventas, detalles, new ClientesFalsos(), repuestos, stock, new SinTransaccion());
    });

    const vender = (categoria: string, codigo: string, vin: string = VIN, opciones = {}) => {
      repuestos.categoria = categoria;
      repuestos.codigo = codigo;
      return service.registrar({ vin, lineas: [{ repuestoId: R1, cantidad: 2 }] }, opciones);
    };

    it('guarda el VIN en mayúsculas y rechaza uno mal formado antes de mover el stock', async () => {
      const { venta } = await vender('Frenos', 'PAS-DEL-CER', ' 3mzbp2sm1sm600006 ');
      expect(venta.vin).toBe(VIN);

      stock.descuentos = [];
      await expect(vender('Frenos', 'PAS-DEL-CER', 'ABC')).rejects.toThrow('17');
      await expect(vender('Frenos', 'PAS-DEL-CER', '3MZBP2SM1SM60000O')).rejects.toThrow('17');
      expect(stock.descuentos).toEqual([]);
    });

    it('devuelve lo vendido para ese VIN y esa categoría, convirtiendo la del catálogo', async () => {
      await vender('Suspensión', 'AMO-TRA-GAS');
      await vender('Frenos y discos', 'DIS-DEL-VENT');

      expect(await service.comprasPorVin({ vin: VIN, categoria: 'suspension' })).toEqual([
        expect.objectContaining({ codigoRepuesto: 'AMO-TRA-GAS', categoria: 'suspension', cantidad: 2, codigoOrden: null }),
      ]);
      expect(await service.comprasPorVin({ vin: VIN, categoria: 'frenos' })).toEqual([
        expect.objectContaining({ codigoRepuesto: 'DIS-DEL-VENT', categoria: 'frenos' }),
      ]);
      expect(await service.comprasPorVin({ vin: VIN, categoria: 'motor' })).toEqual([]);
    });

    it('no cuenta otro VIN, ventas sin VIN ni categorías que no son de garantía', async () => {
      await vender('Frenos', 'PAS-DEL-CER', '9FBHJD204PM100001');
      repuestos.categoria = 'Frenos';
      await service.registrar({ lineas: [{ repuestoId: R1, cantidad: 1 }] });
      await vender('Lubricantes', 'ACE-5W30-1L');

      expect(await service.comprasPorVin({ vin: VIN, categoria: 'frenos' })).toEqual([]);
      expect(await service.comprasPorVin({ vin: VIN, categoria: 'motor' })).toEqual([]);
    });

    it('filtra por código y conserva la orden de taller', async () => {
      await vender('Frenos', 'PAS-DEL-CER', VIN, { codigoOrden: 'OT-0022' });
      await vender('Frenos', 'DIS-DEL-VENT');

      expect(await service.comprasPorVin({ vin: VIN, categoria: 'frenos', codigoRepuesto: 'pas-del-cer' })).toEqual([
        expect.objectContaining({ codigoRepuesto: 'PAS-DEL-CER', codigoOrden: 'OT-0022' }),
      ]);
    });

    it('rechaza un VIN mal formado y una categoría desconocida', async () => {
      await expect(service.comprasPorVin({ vin: 'ABC', categoria: 'frenos' })).rejects.toThrow('17');
      await expect(service.comprasPorVin({ vin: VIN, categoria: 'llantas' })).rejects.toThrow('Categoría desconocida');
    });
  });
});
