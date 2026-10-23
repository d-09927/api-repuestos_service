import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { subtotal } from '../../common/dinero';
import { ValidationDomainError } from '../../common/domain-error';
import { CompraDetalle } from '../domain/entities/compra-detalle.entity';
import { CompraDetalleRepositoryPort } from '../domain/ports/compra-detalle.repository.port';
import { LineaCompraCommand } from './dto/linea-compra.command';

/** Casos de uso de las líneas de compra. */
@Injectable()
export class CompraDetallesService {
  constructor(private readonly detalles: CompraDetalleRepositoryPort) {}

  /** Valida y arma las líneas de una compra (sin guardarlas todavía): mínimo una, sin repuestos repetidos. */
  construir(lineas: LineaCompraCommand[]): CompraDetalle[] {
    if (!lineas || lineas.length === 0) {
      throw new ValidationDomainError('La compra debe tener al menos una línea');
    }
    const vistos = new Set<string>();
    return lineas.map((linea) => {
      if (vistos.has(linea.repuestoId)) {
        throw new ValidationDomainError(`El repuesto ${linea.sku} está repetido en la compra`);
      }
      vistos.add(linea.repuestoId);

      if (!Number.isInteger(linea.cantidad) || linea.cantidad <= 0) {
        throw new ValidationDomainError(`La cantidad de ${linea.sku} debe ser un entero mayor que 0`);
      }
      if (!Number.isFinite(linea.costoUnitario) || linea.costoUnitario < 0) {
        throw new ValidationDomainError(`El costo unitario de ${linea.sku} debe ser mayor o igual a 0`);
      }
      return new CompraDetalle({
        id: randomUUID(),
        compraId: linea.compraId,
        repuestoId: linea.repuestoId,
        sku: linea.sku,
        nombre: linea.nombre,
        cantidad: linea.cantidad,
        costoUnitario: linea.costoUnitario,
        subtotal: subtotal(linea.cantidad, linea.costoUnitario),
      });
    });
  }

  guardar(detalles: CompraDetalle[]): Promise<void> {
    return this.detalles.guardarVarios(detalles);
  }

  listarPorCompras(compraIds: string[]): Promise<CompraDetalle[]> {
    return this.detalles.listarPorCompras(compraIds);
  }
}
