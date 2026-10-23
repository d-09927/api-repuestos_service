import { VentaDetalle } from '../domain/entities/venta-detalle.entity';
import { VentaDetalleRepositoryPort } from '../domain/ports/venta-detalle.repository.port';
import { VentaDetallesService } from './venta-detalles.service';

class DetallesEnMemoria extends VentaDetalleRepositoryPort {
  filas: VentaDetalle[] = [];
  async guardarVarios(d: VentaDetalle[]) {
    this.filas.push(...d);
  }
  async listarPorVentas(ids: string[]) {
    return this.filas.filter((d) => ids.includes(d.ventaId));
  }
}

const linea = (repuestoId: string, cantidad: number, precioUnitario: number) => ({
  ventaId: 'venta-1',
  repuestoId,
  sku: `SKU-${repuestoId}`,
  nombre: `Repuesto ${repuestoId}`,
  cantidad,
  precioUnitario,
});

describe('VentaDetallesService', () => {
  const service = new VentaDetallesService(new DetallesEnMemoria());

  it('calcula el subtotal sin errores de decimales', () => {
    const detalles = service.construir([linea('a', 3, 0.1), linea('b', 2, 27000.55)]);
    expect(detalles.map((d) => d.subtotal)).toEqual([0.3, 54001.1]);
  });

  it('exige al menos una línea', () => {
    expect(() => service.construir([])).toThrow('al menos una línea');
  });

  it('rechaza repuestos repetidos, cantidades inválidas y costos negativos', () => {
    expect(() => service.construir([linea('a', 1, 1), linea('a', 2, 1)])).toThrow('repetido');
    expect(() => service.construir([linea('a', 0, 1)])).toThrow('mayor que 0');
    expect(() => service.construir([linea('a', 1.5, 1)])).toThrow('mayor que 0');
    expect(() => service.construir([linea('a', 1, -1)])).toThrow('precio unitario');
  });

  it('guarda y lista las líneas por compra', async () => {
    const detalles = service.construir([linea('a', 1, 10)]);
    await service.guardar(detalles);
    expect(await service.listarPorVentas(['venta-1'])).toHaveLength(1);
    expect(await service.listarPorVentas(['otra'])).toHaveLength(0);
  });
});
