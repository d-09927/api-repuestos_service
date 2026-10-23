import { Compatibilidad } from '../domain/entities/compatibilidad.entity';
import { CompatibilidadRepositoryPort } from '../domain/ports/compatibilidad.repository.port';
import { CompatibilidadesService } from './compatibilidades.service';

class CompatibilidadesEnMemoria extends CompatibilidadRepositoryPort {
  filas: Compatibilidad[] = [];
  async reemplazarDeRepuesto(repuestoId: string, lista: Compatibilidad[]) {
    this.filas = [...this.filas.filter((c) => c.repuestoId !== repuestoId), ...lista];
  }
  async listarPorRepuestos(ids: string[]) {
    return this.filas.filter((c) => ids.includes(c.repuestoId));
  }
  async repuestoIdsPorVehiculo() {
    return [];
  }
}

const base = { marca: ' Toyota ', modelo: 'Hilux', anioDesde: 2015, anioHasta: 2020 };

describe('CompatibilidadesService', () => {
  let service: CompatibilidadesService;
  beforeEach(() => {
    service = new CompatibilidadesService(new CompatibilidadesEnMemoria());
  });

  it('limpia los textos y guarda el rango de años', async () => {
    const [c] = await service.reemplazar('r-1', [base]);
    expect(c.marca).toBe('Toyota');
    expect(c.anioDesde).toBe(2015);
    expect(c.repuestoId).toBe('r-1');
  });

  it('valida el rango de años y los textos', async () => {
    await expect(service.reemplazar('r-1', [{ ...base, anioDesde: 2020, anioHasta: 2015 }])).rejects.toThrow();
    await expect(service.reemplazar('r-1', [{ ...base, anioDesde: 2015.5 }])).rejects.toThrow('enteros');
    await expect(service.reemplazar('r-1', [{ ...base, marca: ' ' }])).rejects.toThrow(
      'La marca del vehículo es obligatorio',
    );
  });

  it('reemplazar deja exactamente la lista nueva', async () => {
    await service.reemplazar('r-1', [base, { ...base, modelo: 'Corolla' }]);
    await service.reemplazar('r-1', [{ ...base, modelo: 'Yaris' }]);
    const lista = await service.listarPorRepuesto('r-1');
    expect(lista.map((c) => c.modelo)).toEqual(['Yaris']);
  });
});
