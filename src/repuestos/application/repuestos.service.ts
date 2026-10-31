import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError, ValidationDomainError } from '../../common/domain-error';
import { PaginaResultado } from '../../common/paginacion';
import { UnidadDeTrabajoPort } from '../../common/unidad-de-trabajo/unidad-de-trabajo.port';
import { textoObligatorio } from '../../common/validaciones';
import { Repuesto } from '../domain/entities/repuesto.entity';
import { CompatibilidadServicePort } from '../domain/ports/compatibilidad.service.port';
import { RepuestoRepositoryPort } from '../domain/ports/repuesto.repository.port';
import { CreateRepuestoCommand } from './dto/create-repuesto.command';
import { ListRepuestosQuery } from './dto/list-repuestos.query';
import { RepuestoDetalle } from './dto/repuesto-detalle.result';
import { UpdateRepuestoCommand } from './dto/update-repuesto.command';

/** Casos de uso de repuestos. */
@Injectable()
export class RepuestosService {
  constructor(
    private readonly repuestos: RepuestoRepositoryPort,
    private readonly compatibilidades: CompatibilidadServicePort,
    private readonly unidadDeTrabajo: UnidadDeTrabajoPort,
  ) {}

  async crear(cmd: CreateRepuestoCommand): Promise<RepuestoDetalle> {
    const sku = textoObligatorio(cmd.sku, 'El SKU', 50).toUpperCase();
    if (await this.repuestos.buscarPorSku(sku)) {
      throw new ConflictError(`Ya existe un repuesto con el SKU ${sku}`);
    }
    const ahora = new Date();
    const repuesto = new Repuesto({
      id: randomUUID(),
      sku,
      codigoUniversal: this.normalizarCodigo(cmd.codigoUniversal),
      nombre: textoObligatorio(cmd.nombre, 'El nombre', 200),
      descripcion: cmd.descripcion?.trim() || null,
      marca: textoObligatorio(cmd.marca, 'La marca', 100),
      categoria: textoObligatorio(cmd.categoria, 'La categoría', 100),
      precio: this.validarPrecio(cmd.precio),
      activo: true,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
    const compatibilidad = await this.unidadDeTrabajo.ejecutar(async () => {
      await this.repuestos.guardar(repuesto);
      return this.compatibilidades.reemplazar(repuesto.id, cmd.compatibilidad ?? []);
    });
    return { repuesto, compatibilidad };
  }

  async listar(query: ListRepuestosQuery): Promise<PaginaResultado<RepuestoDetalle>> {
    let ids: string[] | undefined;
    if (query.vehiculoMarca && query.vehiculoModelo) {
      ids = await this.compatibilidades.repuestoIdsPorVehiculo({
        marca: query.vehiculoMarca,
        modelo: query.vehiculoModelo,
        anio: query.vehiculoAnio,
      });
      if (!ids.length) return { items: [], total: 0, pagina: query.pagina, limite: query.limite };
    }
    const pagina = await this.repuestos.listar({
      texto: query.texto,
      codigoUniversal: query.codigoUniversal,
      marca: query.marca,
      categoria: query.categoria,
      ids,
      incluirInactivos: query.incluirInactivos,
      pagina: query.pagina,
      limite: query.limite,
    });
    const compatibles = await this.compatibilidades.listarPorRepuestos(pagina.items.map((r) => r.id));
    return {
      ...pagina,
      items: pagina.items.map((repuesto) => ({
        repuesto,
        compatibilidad: compatibles.filter((c) => c.repuestoId === repuesto.id),
      })),
    };
  }

  async obtenerDetalle(id: string): Promise<RepuestoDetalle> {
    const repuesto = await this.obtener(id);
    const compatibilidad = await this.compatibilidades.listarPorRepuestos([id]);
    return { repuesto, compatibilidad };
  }

  /** Solo el repuesto (sin compatibilidades): lo usan stock, compras y ventas. */
  async obtener(id: string): Promise<Repuesto> {
    const repuesto = await this.repuestos.buscarPorId(id);
    if (!repuesto) throw new NotFoundError(`No existe el repuesto ${id}`);
    return repuesto;
  }

  async actualizar(id: string, cmd: UpdateRepuestoCommand): Promise<RepuestoDetalle> {
    const repuesto = await this.obtener(id);
    if (cmd.codigoUniversal !== undefined) repuesto.codigoUniversal = this.normalizarCodigo(cmd.codigoUniversal);
    if (cmd.nombre !== undefined) repuesto.nombre = textoObligatorio(cmd.nombre, 'El nombre', 200);
    if (cmd.descripcion !== undefined) repuesto.descripcion = cmd.descripcion?.trim() || null;
    if (cmd.marca !== undefined) repuesto.marca = textoObligatorio(cmd.marca, 'La marca', 100);
    if (cmd.categoria !== undefined) repuesto.categoria = textoObligatorio(cmd.categoria, 'La categoría', 100);
    if (cmd.precio !== undefined) repuesto.precio = this.validarPrecio(cmd.precio);
    repuesto.actualizadoEn = new Date();
    await this.unidadDeTrabajo.ejecutar(async () => {
      await this.repuestos.guardar(repuesto);
      if (cmd.compatibilidad !== undefined) {
        await this.compatibilidades.reemplazar(id, cmd.compatibilidad);
      }
    });
    return { repuesto, compatibilidad: await this.compatibilidades.listarPorRepuestos([id]) };
  }

  /** Los repuestos no se borran (tienen historial de movimientos): se desactivan. */
  async desactivar(id: string): Promise<void> {
    const repuesto = await this.obtener(id);
    repuesto.activo = false;
    repuesto.actualizadoEn = new Date();
    await this.repuestos.guardar(repuesto);
  }

  /** Para otros módulos (stock, compras, ventas): el repuesto debe existir y estar activo. */
  async verificarActivo(id: string): Promise<Repuesto> {
    const repuesto = await this.obtener(id);
    if (!repuesto.activo) throw new ConflictError(`El repuesto ${repuesto.sku} está desactivado`);
    return repuesto;
  }

  /** Mayúsculas y sin espacios, como lo envían taller y facturación (PAS-DEL-CER). Vacío o null: sin código. */
  private normalizarCodigo(codigo: string | null | undefined): string | null {
    const limpio = codigo?.trim().toUpperCase();
    if (!limpio) return null;
    if (limpio.length > 50) throw new ValidationDomainError('El código universal no puede superar 50 caracteres');
    return limpio;
  }

  private validarPrecio(precio: number): number {
    if (!Number.isFinite(precio) || precio < 0) {
      throw new ValidationDomainError('El precio debe ser un número mayor o igual a 0');
    }
    return Math.round(precio * 100) / 100;
  }
}
