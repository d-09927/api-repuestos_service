import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { subtotal } from '../../common/dinero';
import { ValidationDomainError } from '../../common/domain-error';
import { VentaDetalle } from '../domain/entities/venta-detalle.entity';
import { VentaDetalleRepositoryPort } from '../domain/ports/venta-detalle.repository.port';
import { LineaVentaCommand } from './dto/linea-venta.command';

/** Casos de uso de las líneas de venta. */
@Injectable()
export class VentaDetallesService {
  constructor(private readonly detalles: VentaDetalleRepositoryPort) {}

  /** Valida y arma las líneas de una venta (sin guardarlas todavía): mínimo una, sin repuestos repetidos. */
  construir(lineas: LineaVentaCommand[]): VentaDetalle[] {
    if (!lineas || lineas.length === 0) {
      throw new ValidationDomainError('La venta debe tener al menos una línea');
    }
    const vistos = new Set<string>();
    return lineas.map((linea) => {
      if (vistos.has(linea.repuestoId)) {
        throw new ValidationDomainError(`El repuesto ${linea.sku} está repetido en la venta`);
      }
      vistos.add(linea.repuestoId);

      if (!Number.isInteger(linea.cantidad) || linea.cantidad <= 0) {
        throw new ValidationDomainError(`La cantidad de ${linea.sku} debe ser un entero mayor que 0`);
      }
      if (!Number.isFinite(linea.precioUnitario) || linea.precioUnitario < 0) {
        throw new ValidationDomainError(`El precio unitario de ${linea.sku} debe ser mayor o igual a 0`);
      }
      return new VentaDetalle({
        id: randomUUID(),
        ventaId: linea.ventaId,
        repuestoId: linea.repuestoId,
        sku: linea.sku,
        nombre: linea.nombre,
        codigoUniversal: linea.codigoUniversal ?? null,
        categoria: linea.categoria ?? null,
        cantidad: linea.cantidad,
        precioUnitario: linea.precioUnitario,
        subtotal: subtotal(linea.cantidad, linea.precioUnitario),
      });
    });
  }

  guardar(detalles: VentaDetalle[]): Promise<void> {
    return this.detalles.guardarVarios(detalles);
  }

  listarPorVentas(ventaIds: string[]): Promise<VentaDetalle[]> {
    return this.detalles.listarPorVentas(ventaIds);
  }
}
