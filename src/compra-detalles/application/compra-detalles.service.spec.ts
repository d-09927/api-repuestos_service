import { CompraDetalle } from '../domain/entities/compra-detalle.entity';
import { CompraDetalleRepositoryPort } from '../domain/ports/compra-detalle.repository.port';
import { CompraDetallesService } from './compra-detalles.service';

class DetallesEnMemoria extends CompraDetalleRepositoryPort {
  filas: CompraDetalle[] = [];
  async guardarVarios(d: CompraDetalle[]) {
    this.filas.push(...d);
  }
  async listarPorCompras(ids: string[]) {
    return this.filas.filter((d) => ids.includes(d.compraId));
  }
}

const linea = (repuestoId: string, cantidad: number, costoUnitario: number) => ({
  compraId: 'compra-1',
  repuestoId,
  sku: `SKU-${repuestoId}`,
  nombre: `Repuesto ${repuestoId}`,
  cantidad,
  costoUnitario,
});

describe('CompraDetallesService', () => {
  const service = new CompraDetallesService(new DetallesEnMemoria());

  it('calcula el subtotal sin errores de decimales', () => {
    const detalles = service.construir([linea('a', 3, 0.1), linea('b', 2, 12500.55)]);
    expect(detalles.map((d) => d.subtotal)).toEqual([0.3, 25001.1]);
  });

  it('exige al menos una línea', () => {
    expect(() => service.construir([])).toThrow('al menos una línea');
  });

  it('rechaza repuestos repetidos, cantidades inválidas y costos negativos', () => {
    expect(() => service.construir([linea('a', 1, 1), linea('a', 2, 1)])).toThrow('repetido');
    expect(() => service.construir([linea('a', 0, 1)])).toThrow('mayor que 0');
    expect(() => service.construir([linea('a', 1.5, 1)])).toThrow('mayor que 0');
    expect(() => service.construir([linea('a', 1, -1)])).toThrow('costo unitario');
  });

  it('guarda y lista las líneas por compra', async () => {
    const detalles = service.construir([linea('a', 1, 10)]);
    await service.guardar(detalles);
    expect(await service.listarPorCompras(['compra-1'])).toHaveLength(1);
    expect(await service.listarPorCompras(['otra'])).toHaveLength(0);
  });
});
