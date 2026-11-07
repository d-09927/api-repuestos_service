import { ConflictError, NotFoundError, ValidationDomainError } from '../../common/domain-error';
import { Pedido, VentaDelPedido } from '../domain/entities/pedido.entity';
import { EstadoPedido } from '../domain/enums/estado-pedido.enum';
import { ClienteServicePort } from '../domain/ports/cliente.service.port';
import { PedidoRepositoryPort } from '../domain/ports/pedido.repository.port';
import { RepuestoDeCodigo, RepuestoServicePort } from '../domain/ports/repuesto.service.port';
import { MovimientoDePedido, StockServicePort } from '../domain/ports/stock.service.port';
import { VentaPorCobrar, VentaServicePort } from '../domain/ports/venta.service.port';
import { PedidosService } from './pedidos.service';

/** Repositorio en memoria: permite probar las reglas sin base de datos. */
class PedidosEnMemoria extends PedidoRepositoryPort {
  filas = new Map<string, Pedido>();
  async guardar(p: Pedido) {
    this.filas.set(p.codigoOrden, structuredClone(p));
  }
  async buscarPorCodigoOrden(codigo: string) {
    const p = this.filas.get(codigo);
    return p ? new Pedido(structuredClone(p)) : null;
  }
  async listar() {
    return [...this.filas.values()];
  }
}

class RepuestosFalsos extends RepuestoServicePort {
  catalogo = new Map<string, RepuestoDeCodigo[]>();
  async porCodigoUniversal(codigo: string) {
    return this.catalogo.get(codigo) ?? [];
  }
}

/** Stock por repuesto y bodega: disponible y reservado. */
class StockFalso extends StockServicePort {
  disponible = new Map<string, number>();
  reservado = new Map<string, number>();
  reservas: MovimientoDePedido[] = [];
  liberaciones: MovimientoDePedido[] = [];
  fallarReservaEn?: string;

  poner(repuestoId: string, bodega: string, unidades: number) {
    this.disponible.set(`${repuestoId}|${bodega}`, unidades);
  }
  async disponiblePorBodega(repuestoId: string) {
    return [...this.disponible.entries()]
      .filter(([k]) => k.startsWith(`${repuestoId}|`))
      .map(([k, disponible]) => ({ bodega: k.split('|')[1], disponible }));
  }
  async reservar(m: MovimientoDePedido) {
    if (m.bodega === this.fallarReservaEn) throw new ConflictError('Solo hay 0 unidad(es) disponible(s)');
    for (const l of m.lineas) {
      const k = `${l.repuestoId}|${m.bodega}`;
      this.disponible.set(k, (this.disponible.get(k) ?? 0) - l.cantidad);
      this.reservado.set(k, (this.reservado.get(k) ?? 0) + l.cantidad);
    }
    this.reservas.push(m);
  }
  async liberar(m: MovimientoDePedido) {
    for (const l of m.lineas) {
      const k = `${l.repuestoId}|${m.bodega}`;
      this.disponible.set(k, (this.disponible.get(k) ?? 0) + l.cantidad);
      this.reservado.set(k, (this.reservado.get(k) ?? 0) - l.cantidad);
    }
    this.liberaciones.push(m);
  }
}

class VentasFalsas extends VentaServicePort {
  registradas: VentaPorCobrar[] = [];
  pagadas: { ventaId: string; referencia: string }[] = [];
  async registrarPorCobrar(v: VentaPorCobrar): Promise<VentaDelPedido> {
    this.registradas.push(v);
    const n = this.registradas.length;
    return { id: `venta-${n}`, numero: `V-00000${n}`, bodega: v.bodega, total: 100 * n };
  }
  async marcarPagada(ventaId: string, referencia: string) {
    this.pagadas.push({ ventaId, referencia });
  }
}

class ClientesFalsos extends ClienteServicePort {
  async comprador() {
    return 'cliente-facturacion';
  }
}

const MONROE = { id: 'monroe', sku: 'MON-AMO-DEL-GAS', nombre: 'Amortiguador Monroe', precio: 288300 };
const KYB = { id: 'kyb', sku: 'KYB-AMO-DEL-GAS', nombre: 'Amortiguador KYB', precio: 265000 };
const BOSCH = { id: 'bosch', sku: 'BOS-PAS-DEL-CER', nombre: 'Pastillas Bosch', precio: 172050 };

describe('PedidosService', () => {
  let pedidos: PedidosEnMemoria;
  let repuestos: RepuestosFalsos;
  let stock: StockFalso;
  let ventas: VentasFalsas;
  let service: PedidosService;

  beforeEach(() => {
    pedidos = new PedidosEnMemoria();
    repuestos = new RepuestosFalsos();
    stock = new StockFalso();
    ventas = new VentasFalsas();
    service = new PedidosService(pedidos, repuestos, stock, ventas, new ClientesFalsos());

    repuestos.catalogo.set('AMO-DEL-GAS', [MONROE, KYB]);
    repuestos.catalogo.set('PAS-DEL-CER', [BOSCH]);
    stock.poner('monroe', 'PRINCIPAL', 6);
    stock.poner('kyb', 'PRINCIPAL', 1);
    stock.poner('bosch', 'PRINCIPAL', 8);
  });

  const despachar = (idMensaje = 'm-despachar', lineas = [{ codigoUniversal: 'amo-del-gas', cantidad: 2 }, { codigoUniversal: 'PAS-DEL-CER', cantidad: 1 }]) =>
    service.despachar({ codigoOrden: ' ot-0054 ', idMensaje, lineas });

  describe('despachar (el cliente aceptó la cotización)', () => {
    it('elige la marca más barata que alcance, la aparta y deja la venta PENDIENTE_PAGO; el pedido queda DESPACHADO', async () => {
      const p = await despachar();

      expect(p.codigoOrden).toBe('OT-0054');
      expect(p.estado).toBe(EstadoPedido.DESPACHADO);
      // KYB es más barato pero solo hay 1: se despacha Monroe.
      expect(p.lineas.map((l) => [l.codigoUniversal, l.sku, l.bodega, l.cantidadApartada, l.cantidadEntregada])).toEqual([
        ['AMO-DEL-GAS', 'MON-AMO-DEL-GAS', 'PRINCIPAL', 2, 2],
        ['PAS-DEL-CER', 'BOS-PAS-DEL-CER', 'PRINCIPAL', 1, 1],
      ]);
      const lineasVendidas = [{ repuestoId: 'monroe', cantidad: 2 }, { repuestoId: 'bosch', cantidad: 1 }];
      expect(stock.reservas).toEqual([{ bodega: 'PRINCIPAL', referencia: 'OT-0054', lineas: lineasVendidas }]);
      // La venta sale de lo reservado, a nombre de facturación; nada se libera.
      expect(ventas.registradas).toEqual([
        { clienteId: 'cliente-facturacion', codigoOrden: 'OT-0054', vin: null, bodega: 'PRINCIPAL', observaciones: 'Orden de taller OT-0054', lineas: lineasVendidas },
      ]);
      expect(p.ventas).toEqual([{ id: 'venta-1', numero: 'V-000001', bodega: 'PRINCIPAL', total: 100 }]);
      expect(stock.liberaciones).toEqual([]);
      expect(pedidos.filas.get('OT-0054')?.estado).toBe(EstadoPedido.DESPACHADO);
    });

    it('con una sola unidad pedida, la más barata (KYB) sí alcanza', async () => {
      const p = await despachar('m', [{ codigoUniversal: 'AMO-DEL-GAS', cantidad: 1 }]);
      expect(p.lineas[0].sku).toBe('KYB-AMO-DEL-GAS');
    });

    it('una venta por bodega', async () => {
      repuestos.catalogo.set('FIL-ACE-STD', [{ id: 'mann', sku: 'MAN', nombre: 'Filtro', precio: 1 }]);
      stock.poner('mann', 'NORTE', 5);
      const p = await despachar('m', [{ codigoUniversal: 'PAS-DEL-CER', cantidad: 1 }, { codigoUniversal: 'FIL-ACE-STD', cantidad: 2 }]);
      expect(ventas.registradas.map((v) => v.bodega)).toEqual(['PRINCIPAL', 'NORTE']);
      expect(p.ventas).toHaveLength(2);
    });

    it('rechaza un código que no manejamos y uno que no alcanza en una misma bodega, sin vender nada', async () => {
      await expect(despachar('m', [{ codigoUniversal: 'XYZ-1', cantidad: 1 }])).rejects.toThrow(NotFoundError);
      stock.poner('monroe', 'NORTE', 3);
      await expect(despachar('m', [{ codigoUniversal: 'AMO-DEL-GAS', cantidad: 7 }])).rejects.toThrow('en una misma bodega (como máximo hay 6)');
      expect(stock.reservas).toEqual([]);
      expect(ventas.registradas).toEqual([]);
    });

    it('valida las líneas: al menos una, sin repetir, cantidades enteras positivas, e id_mensaje obligatorio', async () => {
      await expect(despachar('m', [])).rejects.toThrow('al menos un repuesto');
      await expect(despachar('m', [{ codigoUniversal: 'PAS-DEL-CER', cantidad: 1 }, { codigoUniversal: 'pas-del-cer', cantidad: 1 }])).rejects.toThrow('repetido');
      await expect(despachar('m', [{ codigoUniversal: 'PAS-DEL-CER', cantidad: 0 }])).rejects.toThrow(ValidationDomainError);
      await expect(despachar(' ')).rejects.toThrow('id_mensaje');
    });

    it('es todo o nada entre bodegas al apartar: si una falla, se libera lo apartado y no se vende', async () => {
      repuestos.catalogo.set('FIL-ACE-STD', [{ id: 'mann', sku: 'MAN', nombre: 'Filtro', precio: 1 }]);
      stock.poner('mann', 'NORTE', 5);
      stock.fallarReservaEn = 'NORTE';

      await expect(despachar('m', [{ codigoUniversal: 'PAS-DEL-CER', cantidad: 1 }, { codigoUniversal: 'FIL-ACE-STD', cantidad: 1 }])).rejects.toThrow(ConflictError);

      expect(stock.liberaciones).toEqual(stock.reservas);
      expect(stock.reservado.get('bosch|PRINCIPAL')).toBe(0);
      expect(pedidos.filas.size).toBe(0);
      expect(ventas.registradas).toEqual([]);
    });

    it('si la venta falla, el pedido queda APARTADO y el reintento termina sin vender dos veces', async () => {
      repuestos.catalogo.set('FIL-ACE-STD', [{ id: 'mann', sku: 'MAN', nombre: 'Filtro', precio: 1 }]);
      stock.poner('mann', 'NORTE', 5);
      const lineas = [{ codigoUniversal: 'PAS-DEL-CER', cantidad: 1 }, { codigoUniversal: 'FIL-ACE-STD', cantidad: 1 }];
      const original = ventas.registrarPorCobrar.bind(ventas);
      jest.spyOn(ventas, 'registrarPorCobrar')
        .mockImplementationOnce(original)
        .mockRejectedValueOnce(new Error('la base de datos se cayó'));

      await expect(despachar('m-1', lineas)).rejects.toThrow('se cayó');
      const aMedias = pedidos.filas.get('OT-0054')!;
      expect(aMedias.estado).toBe(EstadoPedido.APARTADO);
      expect(aMedias.ventas.map((v) => v.bodega)).toEqual(['PRINCIPAL']);

      const p = await despachar('m-1', lineas);
      expect(p.estado).toBe(EstadoPedido.DESPACHADO);
      expect(ventas.registradas.map((v) => v.bodega)).toEqual(['PRINCIPAL', 'NORTE']);
      expect(stock.reservas).toHaveLength(2); // no se volvió a apartar
    });

    it('un pedido APARTADO de antes se despacha con lo que tenía apartado', async () => {
      await pedidos.guardar(
        new Pedido({
          id: 'p-viejo', codigoOrden: 'OT-0054', vin: null, estado: EstadoPedido.APARTADO, ventas: [], mensajes: ['viejo'],
          referenciaPago: null, creadoEn: new Date(), actualizadoEn: new Date(),
          lineas: [{ codigoUniversal: 'PAS-DEL-CER', repuestoId: 'bosch', sku: 'BOS-PAS-DEL-CER', nombre: 'Pastillas Bosch', bodega: 'PRINCIPAL', precioUnitario: 172050, cantidadApartada: 2, cantidadEntregada: 0 }],
        }),
      );
      const p = await despachar('m-nuevo', [{ codigoUniversal: 'PAS-DEL-CER', cantidad: 1 }]);
      expect(p.estado).toBe(EstadoPedido.DESPACHADO);
      expect(ventas.registradas[0].lineas).toEqual([{ repuestoId: 'bosch', cantidad: 2 }]);
      expect(stock.reservas).toEqual([]);
    });

    it('un reintento con el mismo id_mensaje no repite nada; otro id_mensaje choca', async () => {
      await despachar('m-1');
      const otraVez = await despachar('m-1');

      expect(otraVez.estado).toBe(EstadoPedido.DESPACHADO);
      expect(stock.reservas).toHaveLength(1);
      expect(ventas.registradas).toHaveLength(1);
      await expect(despachar('m-2')).rejects.toThrow('ya tiene un pedido DESPACHADO');
    });
  });

  describe('cancelar', () => {
    const cancelar = (idMensaje = 'm-cancelar') => service.cancelar({ codigoOrden: 'OT-0054', idMensaje });
    const apartadoViejo = () =>
      pedidos.guardar(
        new Pedido({
          id: 'p-viejo', codigoOrden: 'OT-0054', vin: null, estado: EstadoPedido.APARTADO, ventas: [], mensajes: [],
          referenciaPago: null, creadoEn: new Date(), actualizadoEn: new Date(),
          lineas: [{ codigoUniversal: 'PAS-DEL-CER', repuestoId: 'bosch', sku: 'BOS-PAS-DEL-CER', nombre: 'Pastillas Bosch', bodega: 'PRINCIPAL', precioUnitario: 172050, cantidadApartada: 1, cantidadEntregada: 0 }],
        }),
      );

    it('libera lo de un pedido APARTADO; después se puede despachar la misma orden', async () => {
      await apartadoViejo();
      const p = await cancelar();

      expect(p.estado).toBe(EstadoPedido.CANCELADO);
      expect(stock.liberaciones).toEqual([{ bodega: 'PRINCIPAL', referencia: 'OT-0054', lineas: [{ repuestoId: 'bosch', cantidad: 1 }] }]);

      const otra = await despachar('m-despachar-2');
      expect(otra.estado).toBe(EstadoPedido.DESPACHADO);
      expect(otra.ventas).toHaveLength(1);
    });

    it('no se puede cancelar lo ya despachado (tiene factura)', async () => {
      await despachar();
      await expect(cancelar()).rejects.toThrow('está DESPACHADO: no se puede cancelar');
    });
  });

  describe('registrar pago (lo hace facturación)', () => {
    const pagar = (idMensaje = 'm-pago', referenciaPago = 'PSE-1') =>
      service.registrarPago({ codigoOrden: 'OT-0054', idMensaje, referenciaPago });

    it('marca pagadas las ventas del pedido despachado; un reintento no paga dos veces', async () => {
      await despachar();

      const p = await pagar();
      await pagar();

      expect(p).toMatchObject({ estado: EstadoPedido.PAGADO, referenciaPago: 'PSE-1' });
      expect(ventas.pagadas).toEqual([{ ventaId: 'venta-1', referencia: 'PSE-1' }]);
    });

    it('solo se paga un pedido DESPACHADO; sin pedido responde 404', async () => {
      await expect(pagar()).rejects.toThrow(NotFoundError);
      await despachar();
      await pagar();
      await expect(pagar('otro-pago')).rejects.toThrow('está PAGADO: no se puede pagar');
    });
  });

  describe('VIN de la orden', () => {
    const VIN = '3MZBP2SM1SM600006';
    const lineas = [{ codigoUniversal: 'PAS-DEL-CER', cantidad: 1 }];

    it('el VIN y la orden pasan a la venta', async () => {
      await service.despachar({ codigoOrden: 'OT-1', idMensaje: 'a', vin: ' 3mzbp2sm1sm600006 ', lineas });
      expect(ventas.registradas[0]).toMatchObject({ vin: VIN, codigoOrden: 'OT-1' });
    });

    it('un VIN mal formado no aparta ni vende nada', async () => {
      await expect(service.despachar({ codigoOrden: 'OT-1', idMensaje: 'a', vin: 'ABC', lineas })).rejects.toThrow('17');
      expect(stock.reservas).toEqual([]);
      expect(ventas.registradas).toEqual([]);
    });
  });
});
