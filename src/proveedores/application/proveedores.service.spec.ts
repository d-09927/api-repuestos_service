import { PaginaResultado } from '../../common/paginacion';
import { Proveedor } from '../domain/entities/proveedor.entity';
import { ProveedorRepositoryPort } from '../domain/ports/proveedor.repository.port';
import { ProveedoresService } from './proveedores.service';

/** Repositorio en memoria: permite probar las reglas sin base de datos. */
class ProveedoresEnMemoria extends ProveedorRepositoryPort {
  filas = new Map<string, Proveedor>();
  async guardar(p: Proveedor) {
    this.filas.set(p.id, p);
  }
  async buscarPorId(id: string) {
    return this.filas.get(id) ?? null;
  }
  async buscarPorNit(nit: string) {
    return [...this.filas.values()].find((p) => p.nit === nit) ?? null;
  }
  async listar(): Promise<PaginaResultado<Proveedor>> {
    const items = [...this.filas.values()];
    return { items, total: items.length, pagina: 1, limite: 20 };
  }
}

describe('ProveedoresService', () => {
  let service: ProveedoresService;
  beforeEach(() => {
    service = new ProveedoresService(new ProveedoresEnMemoria());
  });

  it('normaliza el NIT y limpia los textos', async () => {
    const p = await service.crear({ nit: ' 900123-4 ', nombre: ' Repuestos del Sur ', email: ' Ventas@Sur.COM ' });
    expect(p.nit).toBe('900123-4');
    expect(p.nombre).toBe('Repuestos del Sur');
    expect(p.email).toBe('ventas@sur.com');
    expect(p.contacto).toBeNull();
    expect(p.activo).toBe(true);
  });

  it('exige NIT y nombre, y valida el email', async () => {
    await expect(service.crear({ nit: ' ', nombre: 'x' })).rejects.toThrow('El NIT es obligatorio');
    await expect(service.crear({ nit: '1', nombre: '' })).rejects.toThrow('El nombre es obligatorio');
    await expect(service.crear({ nit: '1', nombre: 'x', email: 'malo' })).rejects.toThrow('formato');
  });

  it('no permite dos proveedores con el mismo NIT', async () => {
    await service.crear({ nit: '900', nombre: 'A' });
    await expect(service.crear({ nit: ' 900 ', nombre: 'B' })).rejects.toThrow('Ya existe un proveedor');
  });

  it('actualiza solo lo que se envía y puede desactivarse', async () => {
    const p = await service.crear({ nit: '900', nombre: 'A', telefono: '300' });
    await service.actualizar(p.id, { nombre: 'B' });
    const actualizado = await service.obtener(p.id);
    expect(actualizado.nombre).toBe('B');
    expect(actualizado.telefono).toBe('300');

    await service.desactivar(p.id);
    await expect(service.verificarActivo(p.id)).rejects.toThrow('desactivado');
  });
});
