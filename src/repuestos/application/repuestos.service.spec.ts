import { PaginaResultado } from '../../common/paginacion';
import { UnidadDeTrabajoPort } from '../../common/unidad-de-trabajo/unidad-de-trabajo.port';
import { Repuesto } from '../domain/entities/repuesto.entity';
import { CompatibilidadInfo, CompatibilidadServicePort } from '../domain/ports/compatibilidad.service.port';
import { RepuestoRepositoryPort } from '../domain/ports/repuesto.repository.port';
import { RepuestosService } from './repuestos.service';

class RepuestosEnMemoria extends RepuestoRepositoryPort {
  filas = new Map<string, Repuesto>();
  async guardar(r: Repuesto) {
    this.filas.set(r.id, r);
  }
  async buscarPorId(id: string) {
    return this.filas.get(id) ?? null;
  }
  async buscarPorSku(sku: string) {
    return [...this.filas.values()].find((r) => r.sku === sku) ?? null;
  }
  async listar(): Promise<PaginaResultado<Repuesto>> {
    const items = [...this.filas.values()];
    return { items, total: items.length, pagina: 1, limite: 20 };
  }
}

class CompatibilidadesFalsas extends CompatibilidadServicePort {
  filas: CompatibilidadInfo[] = [];
  async reemplazar(repuestoId: string, lista: Omit<CompatibilidadInfo, 'repuestoId'>[]) {
    this.filas = lista.map((c) => ({ ...c, repuestoId }));
    return this.filas;
  }
  async listarPorRepuestos() {
    return this.filas;
  }
  async repuestoIdsPorVehiculo() {
    return [];
  }
}

class SinTransaccion extends UnidadDeTrabajoPort {
  ejecutar<T>(trabajo: () => Promise<T>) {
    return trabajo();
  }
}

const base = {
  sku: ' fil-aceite-001 ',
  nombre: 'Filtro de aceite',
  marca: 'Toyota',
  categoria: 'Filtros',
  precio: 25000.456,
};

describe('RepuestosService', () => {
  let service: RepuestosService;
  beforeEach(() => {
    service = new RepuestosService(new RepuestosEnMemoria(), new CompatibilidadesFalsas(), new SinTransaccion());
  });

  it('normaliza el SKU a mayúsculas y redondea el precio a 2 decimales', async () => {
    const { repuesto } = await service.crear(base);
    expect(repuesto.sku).toBe('FIL-ACEITE-001');
    expect(repuesto.precio).toBe(25000.46);
    expect(repuesto.activo).toBe(true);
  });

  it('rechaza campos obligatorios vacíos y precios inválidos', async () => {
    await expect(service.crear({ ...base, nombre: '  ' })).rejects.toThrow('El nombre es obligatorio');
    await expect(service.crear({ ...base, precio: -1 })).rejects.toThrow();
    await expect(service.crear({ ...base, precio: NaN })).rejects.toThrow();
  });

  it('no permite dos repuestos con el mismo SKU', async () => {
    await service.crear(base);
    await expect(service.crear({ ...base, sku: 'FIL-ACEITE-001' })).rejects.toThrow('Ya existe un repuesto');
  });

  it('guarda la compatibilidad junto con el repuesto', async () => {
    const { compatibilidad } = await service.crear({
      ...base,
      compatibilidad: [{ marca: 'Toyota', modelo: 'Hilux', anioDesde: 2015, anioHasta: 2020 }],
    });
    expect(compatibilidad).toHaveLength(1);
  });

  it('actualiza solo lo que se envía y puede desactivarse', async () => {
    const { repuesto } = await service.crear(base);
    await service.actualizar(repuesto.id, { precio: 30000 });
    const actual = await service.obtener(repuesto.id);
    expect(actual.precio).toBe(30000);
    expect(actual.nombre).toBe('Filtro de aceite');

    await service.desactivar(repuesto.id);
    await expect(service.verificarActivo(repuesto.id)).rejects.toThrow('desactivado');
  });

  it('normaliza el código universal; sin código queda null', async () => {
    const { repuesto } = await service.crear({ ...base, codigoUniversal: ' fil-ace-std ' });
    expect(repuesto.codigoUniversal).toBe('FIL-ACE-STD');

    const otro = await service.crear({ ...base, sku: 'OTRO', codigoUniversal: '  ' });
    expect(otro.repuesto.codigoUniversal).toBeNull();
  });

  it('varias marcas pueden compartir el código universal (no es único)', async () => {
    await service.crear({ ...base, sku: 'BOS-FIL', codigoUniversal: 'FIL-ACE-STD' });
    await expect(service.crear({ ...base, sku: 'MAN-FIL', codigoUniversal: 'FIL-ACE-STD' })).resolves.toBeDefined();
  });

  it('en la actualización el código universal se cambia o se quita con null', async () => {
    const { repuesto } = await service.crear({ ...base, codigoUniversal: 'FIL-ACE-STD' });

    await service.actualizar(repuesto.id, { codigoUniversal: 'fil-aire-std' });
    expect((await service.obtener(repuesto.id)).codigoUniversal).toBe('FIL-AIRE-STD');

    await service.actualizar(repuesto.id, { nombre: 'Filtro' });
    expect((await service.obtener(repuesto.id)).codigoUniversal).toBe('FIL-AIRE-STD');

    await service.actualizar(repuesto.id, { codigoUniversal: null });
    expect((await service.obtener(repuesto.id)).codigoUniversal).toBeNull();
  });

  it('rechaza un código universal de más de 50 caracteres', async () => {
    await expect(service.crear({ ...base, codigoUniversal: 'X'.repeat(51) })).rejects.toThrow('50 caracteres');
  });
});
