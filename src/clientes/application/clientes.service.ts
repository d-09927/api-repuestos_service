import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError, ValidationDomainError } from '../../common/domain-error';
import { PaginaResultado } from '../../common/paginacion';
import { emailOpcional, textoObligatorio, textoOpcional } from '../../common/validaciones';
import { Cliente } from '../domain/entities/cliente.entity';
import { TipoDocumento } from '../domain/enums/tipo-documento.enum';
import { ClienteRepositoryPort } from '../domain/ports/cliente.repository.port';
import { CreateClienteCommand } from './dto/create-cliente.command';
import { ListClientesQuery } from './dto/list-clientes.query';
import { UpdateClienteCommand } from './dto/update-cliente.command';

/** Casos de uso y reglas de negocio de clientes. */
@Injectable()
export class ClientesService {
  constructor(private readonly clientes: ClienteRepositoryPort) {}

  async crear(cmd: CreateClienteCommand): Promise<Cliente> {
    if (!Object.values(TipoDocumento).includes(cmd.tipoDocumento)) {
      throw new ValidationDomainError(
        `El tipo de documento debe ser uno de: ${Object.values(TipoDocumento).join(', ')}`,
      );
    }
    const documento = textoObligatorio(cmd.documento, 'El documento', 30).toUpperCase();
    if (await this.clientes.buscarPorDocumento(cmd.tipoDocumento, documento)) {
      throw new ConflictError(`Ya existe un cliente con ${cmd.tipoDocumento} ${documento}`);
    }

    const ahora = new Date();
    const cliente = new Cliente({
      id: randomUUID(),
      tipoDocumento: cmd.tipoDocumento,
      documento,
      nombre: textoObligatorio(cmd.nombre, 'El nombre', 200),
      telefono: textoOpcional(cmd.telefono, 'El teléfono', 30),
      email: emailOpcional(cmd.email),
      direccion: textoOpcional(cmd.direccion, 'La dirección', 250),
      activo: true,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
    await this.clientes.guardar(cliente);
    return cliente;
  }

  listar(query: ListClientesQuery): Promise<PaginaResultado<Cliente>> {
    return this.clientes.listar(query);
  }

  async obtener(id: string): Promise<Cliente> {
    const cliente = await this.clientes.buscarPorId(id);
    if (!cliente) throw new NotFoundError(`No existe el cliente ${id}`);
    return cliente;
  }

  async actualizar(id: string, cmd: UpdateClienteCommand): Promise<Cliente> {
    const cliente = await this.obtener(id);
    if (cmd.nombre !== undefined) cliente.nombre = textoObligatorio(cmd.nombre, 'El nombre', 200);
    if (cmd.telefono !== undefined) cliente.telefono = textoOpcional(cmd.telefono, 'El teléfono', 30);
    if (cmd.email !== undefined) cliente.email = emailOpcional(cmd.email);
    if (cmd.direccion !== undefined) cliente.direccion = textoOpcional(cmd.direccion, 'La dirección', 250);
    cliente.actualizadoEn = new Date();
    await this.clientes.guardar(cliente);
    return cliente;
  }

  /** Los clientes no se borran (tienen ventas asociadas): se desactivan. */
  async desactivar(id: string): Promise<void> {
    const cliente = await this.obtener(id);
    cliente.activo = false;
    cliente.actualizadoEn = new Date();
    await this.clientes.guardar(cliente);
  }

  /** Para otros módulos (ventas): el cliente debe existir y estar activo. */
  async verificarActivo(id: string): Promise<Cliente> {
    const cliente = await this.obtener(id);
    if (!cliente.activo) throw new ConflictError(`El cliente ${cliente.nombre} está desactivado`);
    return cliente;
  }
}
