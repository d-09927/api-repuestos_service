import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PaginaResultado } from '../../common/paginacion';
import { Movimiento } from '../domain/entities/movimiento.entity';
import { MovimientoRepositoryPort } from '../domain/ports/movimiento.repository.port';
import { ListMovimientosQuery } from './dto/list-movimientos.query';
import { RegistrarMovimientoCommand } from './dto/registrar-movimiento.command';

/** Casos de uso del historial de movimientos de inventario. */
@Injectable()
export class MovimientosService {
  constructor(private readonly movimientos: MovimientoRepositoryPort) {}

  async registrar(comandos: RegistrarMovimientoCommand[]): Promise<void> {
    const ahora = new Date();
    await this.movimientos.guardarVarios(
      comandos.map(
        (c) =>
          new Movimiento({
            id: randomUUID(),
            repuestoId: c.repuestoId,
            bodega: c.bodega,
            tipo: c.tipo,
            cantidad: c.cantidad,
            cantidadResultante: c.cantidadResultante,
            motivo: c.motivo?.trim() || null,
            referencia: c.referencia?.trim() || null,
            creadoEn: ahora,
          }),
      ),
    );
  }

  listar(query: ListMovimientosQuery): Promise<PaginaResultado<Movimiento>> {
    return this.movimientos.listar({
      ...query,
      bodega: query.bodega?.trim().toUpperCase() || undefined,
    });
  }
}
