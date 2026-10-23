import { PaginaResultado } from '../../common/paginacion';
import { Cliente } from '../domain/entities/cliente.entity';
import { TipoDocumento } from '../domain/enums/tipo-documento.enum';
import { ClienteRepositoryPort } from '../domain/ports/cliente.repository.port';
import { ClientesService } from './clientes.service';

/** Repositorio en memoria: permite probar las reglas sin base de datos. */
class ClientesEnMemoria extends ClienteRepositoryPort {
  filas = new Map<string, Cliente>();
  async guardar(c: Cliente) {
    this.filas.set(c.id, c);
  }
  async buscarPorId(id: string) {
    return this.filas.get(id) ?? null;
  }
  async buscarPorDocumento(tipo: TipoDocumento, documento: string) {
    return [...this.filas.values()].find((c) => c.tipoDocumento === tipo && c.documento === documento) ?? null;
  }
  async listar(): Promise<PaginaResultado<Cliente>> {
    const items = [...this.filas.values()];
    return { items, total: items.length, pagina: 1, limite: 20 };
  }
}

describe('ClientesService', () => {
  let service: ClientesService;
  beforeEach(() => {
    service = new ClientesService(new ClientesEnMemoria());
  });

  it('normaliza el documento y limpia los textos', async () => {
    const c = await service.crear({
      tipoDocumento: TipoDocumento.PASAPORTE,
      documento: ' ab123 ',
      nombre: ' Ana Pérez ',
    });
    expect(c.documento).toBe('AB123');
    expect(c.nombre).toBe('Ana Pérez');
    expect(c.email).toBeNull();
    expect(c.activo).toBe(true);
  });

  it('exige documento, nombre y un tipo de documento válido', async () => {
    const base = { tipoDocumento: TipoDocumento.CC, documento: '1', nombre: 'x' };
    await expect(service.crear({ ...base, documento: ' ' })).rejects.toThrow('El documento es obligatorio');
    await expect(service.crear({ ...base, nombre: '' })).rejects.toThrow('El nombre es obligatorio');
    await expect(service.crear({ ...base, tipoDocumento: 'XX' as TipoDocumento })).rejects.toThrow(
      'tipo de documento',
    );
  });

  it('valida y normaliza el email', async () => {
    const base = { tipoDocumento: TipoDocumento.CC, documento: '1', nombre: 'x' };
    await expect(service.crear({ ...base, email: 'no-es-email' })).rejects.toThrow('formato');
    expect((await service.crear({ ...base, documento: '2', email: ' Ana@Correo.COM ' })).email).toBe('ana@correo.com');
  });

  it('no permite dos clientes con el mismo tipo y número de documento', async () => {
    const datos = { tipoDocumento: TipoDocumento.CC, documento: '100', nombre: 'Ana' };
    await service.crear(datos);
    await expect(service.crear({ ...datos, nombre: 'Otra' })).rejects.toThrow('Ya existe un cliente');
  });

  it('actualiza solo lo que se envía y puede desactivarse', async () => {
    const c = await service.crear({ tipoDocumento: TipoDocumento.CC, documento: '100', nombre: 'Ana', telefono: '300' });
    await service.actualizar(c.id, { nombre: 'Ana María' });
    const actualizado = await service.obtener(c.id);
    expect(actualizado.nombre).toBe('Ana María');
    expect(actualizado.telefono).toBe('300');

    await service.desactivar(c.id);
    expect((await service.obtener(c.id)).activo).toBe(false);
    await expect(service.verificarActivo(c.id)).rejects.toThrow('desactivado');
  });

  it('responde 404 si el cliente no existe', async () => {
    await expect(service.obtener('no-existe')).rejects.toThrow('No existe el cliente');
  });
});
