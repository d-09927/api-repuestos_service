import { PaginaResultado } from '../../common/paginacion';
import { UnidadDeTrabajoPort } from '../../common/unidad-de-trabajo/unidad-de-trabajo.port';
import { Compra } from '../domain/entities/compra.entity';
import {
  CompraDetalleServicePort,
  DetalleCompraInfo,
  LineaCompraInfo,
} from '../domain/ports/compra-detalle.service.port';
import { CompraRepositoryPort } from '../domain/ports/compra.repository.port';
import { ProveedorServicePort } from '../domain/ports/proveedor.service.port';
import { RepuestoInfo, RepuestoServicePort } from '../domain/ports/repuesto.service.port';
import { MovimientoDeCompra, StockServicePort } from '../domain/ports/stock.service.port';
import { ComprasService } from './compras.service';

const PROVEEDOR = '11111111-1111-4111-8111-111111111111';
const R1 = '22222222-2222-4222-8222-222222222222';

class ComprasEnMemoria extends CompraRepositoryPort {
  filas: Compra[] = [];
  falla = false;
  private n = 0;
  async siguienteConsecutivo() {
    return ++this.n;
  }
  async guardar(c: Compra) {
    if (this.falla) throw new Error('base caída');
    this.filas.push(c);
  }
  async buscarPorId(id: string) {
    return this.filas.find((c) => c.id === id) ?? null;
  }
  async listar(): Promise<PaginaResultado<Compra>> {
    return { items: this.filas, total: this.filas.length, pagina: 1, limite: 20 };
  }
}

class DetallesFalsos extends CompraDetalleServicePort {
  filas: DetalleCompraInfo[] = [];
  construir(lineas: LineaCompraInfo[]) {
    return lineas.map((l, i) => ({ ...l, id: `d-${i}`, subtotal: l.cantidad * l.costoUnitario }));
  }
  async guardar(d: DetalleCompraInfo[]) {
    this.filas.push(...d);
  }
  async listarPorCompras(ids: string[]) {
    return this.filas.filter((d) => ids.includes(d.compraId));
  }
}

class ProveedoresFalsos extends ProveedorServicePort {
  async verificarProveedorActivo() {}
}

class RepuestosFalsos extends RepuestoServicePort {
  async obtenerActivos(ids: string[]): Promise<RepuestoInfo[]> {
    return ids.map((id) => ({ id, sku: 'SKU-1', nombre: 'Filtro' }));
  }
}

class StockFalso extends StockServicePort {
  ingresos: MovimientoDeCompra[] = [];
  reversiones: MovimientoDeCompra[] = [];
  async ingresarMercancia(m: MovimientoDeCompra) {
    this.ingresos.push(m);
  }
  async revertirIngreso(m: MovimientoDeCompra) {
    this.reversiones.push(m);
  }
}

class SinTransaccion extends UnidadDeTrabajoPort {
  ejecutar<T>(trabajo: () => Promise<T>) {
    return trabajo();
  }
}

describe('ComprasService', () => {
  let compras: ComprasEnMemoria;
  let detalles: DetallesFalsos;
  let stock: StockFalso;
  let service: ComprasService;

  beforeEach(() => {
    compras = new ComprasEnMemoria();
    detalles = new DetallesFalsos();
    stock = new StockFalso();
    service = new ComprasService(
      compras,
      detalles,
      new ProveedoresFalsos(),
      new RepuestosFalsos(),
      stock,
      new SinTransaccion(),
    );
  });

  const comando = { proveedorId: PROVEEDOR, lineas: [{ repuestoId: R1, cantidad: 3, costoUnitario: 10 }] };

  it('registra la compra con número, total, bodega por defecto y sus líneas', async () => {
    const { compra, detalles: lineas } = await service.registrar(comando);
    expect(compra.numero).toBe('C-000001');
    expect(compra.total).toBe(30);
    expect(compra.bodega).toBe('PRINCIPAL');
    expect(lineas).toHaveLength(1);
    expect(detalles.filas).toHaveLength(1);
  });

  it('numera con ceros a la izquierda y normaliza la bodega y los textos', async () => {
    await service.registrar(comando);
    const { compra } = await service.registrar({
      ...comando,
      bodega: ' taller ',
      numeroFacturaProveedor: ' FV-1 ',
      observaciones: '  ',
    });
    expect(compra.numero).toBe('C-000002');
    expect(compra.bodega).toBe('TALLER');
    expect(compra.numeroFacturaProveedor).toBe('FV-1');
    expect(compra.observaciones).toBeNull();
  });

  it('ingresa las unidades al stock usando el número de compra como referencia', async () => {
    await service.registrar(comando);
    expect(stock.ingresos).toEqual([
      { bodega: 'PRINCIPAL', referencia: 'C-000001', lineas: [{ repuestoId: R1, cantidad: 3 }] },
    ]);
  });

  it('si no se puede guardar la compra, devuelve el stock', async () => {
    compras.falla = true;
    await expect(service.registrar(comando)).rejects.toThrow('base caída');
    expect(stock.reversiones).toHaveLength(1);
    expect(stock.reversiones[0].referencia).toBe('C-000001');
  });

  it('responde 404 si la compra no existe', async () => {
    await expect(service.obtener('no-existe')).rejects.toThrow('No existe la compra');
  });
});
