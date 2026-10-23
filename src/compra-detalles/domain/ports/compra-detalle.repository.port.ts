import { CompraDetalle } from '../entities/compra-detalle.entity';

/** PUERTO de salida: guardar y leer las líneas de las compras. */
export abstract class CompraDetalleRepositoryPort {
  abstract guardarVarios(detalles: CompraDetalle[]): Promise<void>;
  abstract listarPorCompras(compraIds: string[]): Promise<CompraDetalle[]>;
}
