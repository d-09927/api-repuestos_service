import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../common/domain-error';
import { PaginaResultado } from '../../common/paginacion';
import { emailOpcional, textoObligatorio, textoOpcional } from '../../common/validaciones';
import { Proveedor } from '../domain/entities/proveedor.entity';
import { ProveedorRepositoryPort } from '../domain/ports/proveedor.repository.port';
import { CreateProveedorCommand } from './dto/create-proveedor.command';
import { ListProveedoresQuery } from './dto/list-proveedores.query';
import { UpdateProveedorCommand } from './dto/update-proveedor.command';

/** Casos de uso y reglas de negocio de proveedores. */
@Injectable()
export class ProveedoresService {
  constructor(private readonly proveedores: ProveedorRepositoryPort) {}

  async crear(cmd: CreateProveedorCommand): Promise<Proveedor> {
    const nit = textoObligatorio(cmd.nit, 'El NIT', 30).toUpperCase();
    if (await this.proveedores.buscarPorNit(nit)) {
      throw new ConflictError(`Ya existe un proveedor con el NIT ${nit}`);
    }

    const ahora = new Date();
    const proveedor = new Proveedor({
      id: randomUUID(),
      nit,
      nombre: textoObligatorio(cmd.nombre, 'El nombre', 200),
      contacto: textoOpcional(cmd.contacto, 'El contacto', 150),
      telefono: textoOpcional(cmd.telefono, 'El teléfono', 30),
      email: emailOpcional(cmd.email),
      direccion: textoOpcional(cmd.direccion, 'La dirección', 250),
      activo: true,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
    await this.proveedores.guardar(proveedor);
    return proveedor;
  }

  listar(query: ListProveedoresQuery): Promise<PaginaResultado<Proveedor>> {
    return this.proveedores.listar(query);
  }

  async obtener(id: string): Promise<Proveedor> {
    const proveedor = await this.proveedores.buscarPorId(id);
    if (!proveedor) throw new NotFoundError(`No existe el proveedor ${id}`);
    return proveedor;
  }

  async actualizar(id: string, cmd: UpdateProveedorCommand): Promise<Proveedor> {
    const proveedor = await this.obtener(id);
    if (cmd.nombre !== undefined) proveedor.nombre = textoObligatorio(cmd.nombre, 'El nombre', 200);
    if (cmd.contacto !== undefined) proveedor.contacto = textoOpcional(cmd.contacto, 'El contacto', 150);
    if (cmd.telefono !== undefined) proveedor.telefono = textoOpcional(cmd.telefono, 'El teléfono', 30);
    if (cmd.email !== undefined) proveedor.email = emailOpcional(cmd.email);
    if (cmd.direccion !== undefined) proveedor.direccion = textoOpcional(cmd.direccion, 'La dirección', 250);
    proveedor.actualizadoEn = new Date();
    await this.proveedores.guardar(proveedor);
    return proveedor;
  }

  /** Los proveedores no se borran (tienen compras asociadas): se desactivan. */
  async desactivar(id: string): Promise<void> {
    const proveedor = await this.obtener(id);
    proveedor.activo = false;
    proveedor.actualizadoEn = new Date();
    await this.proveedores.guardar(proveedor);
  }

  /** Para otros módulos (compras): el proveedor debe existir y estar activo. */
  async verificarActivo(id: string): Promise<Proveedor> {
    const proveedor = await this.obtener(id);
    if (!proveedor.activo) throw new ConflictError(`El proveedor ${proveedor.nombre} está desactivado`);
    return proveedor;
  }
}
