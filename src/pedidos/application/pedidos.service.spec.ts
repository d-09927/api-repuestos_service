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

  const apartar = (idMensaje = 'm-apartar', lineas = [{ codigoUniversal: 'amo-del-gas', cantidad: 2 }, { codigoUniversal: 'PAS-DEL-CER', cantidad: 1 }]) =>
    service.apartar({ codigoOrden: ' ot-0054 ', idMensaje, lineas });

  describe('apartar', () => {
    it('elige la marca más barata que alcance en una bodega y la aparta con la orden como referencia', async () => {
      const p = await apartar();

      expect(p.codigoOrden).toBe('OT-0054');
      expect(p.estado).toBe(EstadoPedido.APARTADO);
      // KYB es más barato pero solo hay 1: se aparta Monroe.
      expect(p.lineas.map((l) => [l.codigoUniversal, l.sku, l.bodega, l.cantidadApartada])).toEqual([
        ['AMO-DEL-GAS', 'MON-AMO-DEL-GAS', 'PRINCIPAL', 2],
        ['PAS-DEL-CER', 'BOS-PAS-DEL-CER', 'PRINCIPAL', 1],
      ]);
      expect(stock.reservas).toEqual([
        { bodega: 'PRINCIPAL', referencia: 'OT-0054', lineas: [{ repuestoId: 'monroe', cantidad: 2 }, { repuestoId: 'bosch', cantidad: 1 }] },
      ]);
    });

    it('con una sola unidad pedida, la más barata (KYB) sí alcanza', async () => {
      const p = await apartar('m', [{ codigoUniversal: 'AMO-DEL-GAS', cantidad: 1 }]);
      expect(p.lineas[0].sku).toBe('KYB-AMO-DEL-GAS');
    });

    it('rechaza un código que no manejamos y uno que no alcanza en una misma bodega', async () => {
      await expect(apartar('m', [{ codigoUniversal: 'XYZ-1', cantidad: 1 }])).rejects.toThrow(NotFoundError);
      stock.poner('monroe', 'NORTE', 3);
      await expect(apartar('m', [{ codigoUniversal: 'AMO-DEL-GAS', cantidad: 7 }])).rejects.toThrow('en una misma bodega (como máximo hay 6)');
      expect(stock.reservas).toEqual([]);
    });

    it('valida las líneas: al menos una, sin repetir, cantidades enteras positivas, e id_mensaje obligatorio', async () => {
      await expect(apartar('m', [])).rejects.toThrow('al menos un repuesto');
      await expect(apartar('m', [{ codigoUniversal: 'PAS-DEL-CER', cantidad: 1 }, { codigoUniversal: 'pas-del-cer', cantidad: 1 }])).rejects.toThrow('repetido');
      await expect(apartar('m', [{ codigoUniversal: 'PAS-DEL-CER', cantidad: 0 }])).rejects.toThrow(ValidationDomainError);
      await expect(apartar(' ')).rejects.toThrow('id_mensaje');
    });

    it('es todo o nada entre bodegas: si una falla, se libera lo que ya se apartó', async () => {
      repuestos.catalogo.set('FIL-ACE-STD', [{ id: 'mann', sku: 'MAN', nombre: 'Filtro', precio: 1 }]);
      stock.poner('mann', 'NORTE', 5);
      stock.fallarReservaEn = 'NORTE';

      await expect(apartar('m', [{ codigoUniversal: 'PAS-DEL-CER', cantidad: 1 }, { codigoUniversal: 'FIL-ACE-STD', cantidad: 1 }])).rejects.toThrow(ConflictError);

      expect(stock.liberaciones).toEqual(stock.reservas);
      expect(stock.reservado.get('bosch|PRINCIPAL')).toBe(0);
      expect(pedidos.filas.size).toBe(0);
    });

    it('un reintento con el mismo id_mensaje devuelve el pedido sin apartar otra vez; otro id_mensaje choca', async () => {
      await apartar('m-1');
      const otraVez = await apartar('m-1');

      expect(otraVez.estado).toBe(EstadoPedido.APARTADO);
      expect(stock.reservas).toHaveLength(1);
      await expect(apartar('m-2')).rejects.toThrow('ya tiene un pedido APARTADO');
    });
  });

  describe('entregar', () => {
    const entregar = (usadas: { codigoUniversal: string; cantidad: number }[], idMensaje = 'm-entregar') =>
      service.entregar({ codigoOrden: 'OT-0054', idMensaje, usadas });

    it('genera la venta por cobrar de lo usado a nombre de facturación y libera lo que sobró', async () => {
      await apartar();

      const p = await entregar([{ codigoUniversal: 'AMO-DEL-GAS', cantidad: 2 }]);

      expect(p.estado).toBe(EstadoPedido.ENTREGADO);
      expect(ventas.registradas).toEqual([
        { clienteId: 'cliente-facturacion', codigoOrden: 'OT-0054', vin: null, bodega: 'PRINCIPAL', observaciones: 'Orden de taller OT-0054', lineas: [{ repuestoId: 'monroe', cantidad: 2 }] },
      ]);
      expect(p.ventas).toEqual([{ id: 'venta-1', numero: 'V-000001', bodega: 'PRINCIPAL', total: 100 }]);
      // Las pastillas no se usaron: vuelven a disponible.
      expect(stock.liberaciones).toEqual([{ bodega: 'PRINCIPAL', referencia: 'OT-0054', lineas: [{ repuestoId: 'bosch', cantidad: 1 }] }]);
      expect(p.lineas.map((l) => l.cantidadEntregada)).toEqual([2, 0]);
    });

    it('si no se usó nada, no hay venta y todo vuelve a disponible', async () => {
      await apartar();
      const p = await entregar([]);

      expect(ventas.registradas).toEqual([]);
      expect(p.ventas).toEqual([]);
      expect(stock.liberaciones[0].lineas).toHaveLength(2);
    });

    it('no acepta más de lo apartado ni repuestos que no estaban apartados', async () => {
      await apartar();
      await expect(entregar([{ codigoUniversal: 'AMO-DEL-GAS', cantidad: 3 }])).rejects.toThrow('se apartaron 2');
      await expect(entregar([{ codigoUniversal: 'FIL-ACE-STD', cantidad: 1 }])).rejects.toThrow('no está apartado');
      expect(ventas.registradas).toEqual([]);
    });

    it('un reintento no vuelve a vender; sin pedido responde 404', async () => {
      await expect(entregar([])).rejects.toThrow(NotFoundError);
      await apartar();
      await entregar([{ codigoUniversal: 'AMO-DEL-GAS', cantidad: 1 }]);
      await entregar([{ codigoUniversal: 'AMO-DEL-GAS', cantidad: 1 }]);
      expect(ventas.registradas).toHaveLength(1);
      await expect(entregar([], 'otro-mensaje')).rejects.toThrow('está ENTREGADO: no se puede entregar');
    });
  });

  describe('cancelar', () => {
    const cancelar = (idMensaje = 'm-cancelar') => service.cancelar({ codigoOrden: 'OT-0054', idMensaje });

    it('libera todo lo apartado; después se puede volver a apartar la misma orden', async () => {
      await apartar();
      const p = await cancelar();

      expect(p.estado).toBe(EstadoPedido.CANCELADO);
      expect(stock.reservado.get('monroe|PRINCIPAL')).toBe(0);
      expect(stock.reservado.get('bosch|PRINCIPAL')).toBe(0);

      const otra = await apartar('m-apartar-2');
      expect(otra.estado).toBe(EstadoPedido.APARTADO);
    });

    it('no se puede cancelar lo ya entregado', async () => {
      await apartar();
      await service.entregar({ codigoOrden: 'OT-0054', idMensaje: 'e', usadas: [] });
      await expect(cancelar()).rejects.toThrow('está ENTREGADO: no se puede cancelar');
    });
  });

  describe('registrar pago', () => {
    const pagar = (idMensaje = 'm-pago', referenciaPago = 'PSE-1') =>
      service.registrarPago({ codigoOrden: 'OT-0054', idMensaje, referenciaPago });

    it('marca pagadas las ventas del pedido', async () => {
      await apartar();
      await service.entregar({ codigoOrden: 'OT-0054', idMensaje: 'e', usadas: [{ codigoUniversal: 'PAS-DEL-CER', cantidad: 1 }] });

      const p = await pagar();
      await pagar();

      expect(p).toMatchObject({ estado: EstadoPedido.PAGADO, referenciaPago: 'PSE-1' });
      expect(ventas.pagadas).toEqual([{ ventaId: 'venta-1', referencia: 'PSE-1' }]);
    });

    it('solo se paga un pedido entregado y con algo que cobrar', async () => {
      await apartar();
      await expect(pagar()).rejects.toThrow('está APARTADO: no se puede pagar');
      await service.entregar({ codigoOrden: 'OT-0054', idMensaje: 'e', usadas: [] });
      await expect(pagar()).rejects.toThrow('no hay nada que cobrar');
    });
  });

  describe('VIN de la orden', () => {
    const VIN = '3MZBP2SM1SM600006';
    const lineas = [{ codigoUniversal: 'PAS-DEL-CER', cantidad: 1 }];

    it('el VIN de apartar y la orden pasan a la venta al entregar', async () => {
      await service.apartar({ codigoOrden: 'OT-1', idMensaje: 'a', vin: ' 3mzbp2sm1sm600006 ', lineas });
      await service.entregar({ codigoOrden: 'OT-1', idMensaje: 'b', usadas: lineas });

      expect(ventas.registradas[0]).toMatchObject({ vin: VIN, codigoOrden: 'OT-1' });
    });

    it('el VIN también se puede enviar al entregar', async () => {
      await service.apartar({ codigoOrden: 'OT-1', idMensaje: 'a', lineas });
      await service.entregar({ codigoOrden: 'OT-1', idMensaje: 'b', vin: VIN, usadas: lineas });

      expect(ventas.registradas[0].vin).toBe(VIN);
    });

    it('un VIN mal formado no aparta nada', async () => {
      await expect(service.apartar({ codigoOrden: 'OT-1', idMensaje: 'a', vin: 'ABC', lineas })).rejects.toThrow('17');
      expect(stock.reservas).toEqual([]);
    });
  });
});
