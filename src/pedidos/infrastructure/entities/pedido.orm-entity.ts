import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { LineaPedido, VentaDelPedido } from '../../domain/entities/pedido.entity';

/**
 * Tabla `pedidos`. Las líneas, las ventas generadas y los id_mensaje van en columnas jsonb: siempre
 * se leen y se escriben junto con el pedido (no se consultan por separado).
 */
@Entity({ name: 'pedidos' })
export class PedidoOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  /** Único: si dos peticiones apartan la misma orden a la vez, la segunda falla. */
  @Index({ unique: true })
  @Column({ length: 50 })
  codigoOrden: string;

  @Index()
  @Column({ length: 20 })
  estado: string;

  @Column({ type: 'jsonb' })
  lineas: LineaPedido[];

  @Column({ type: 'jsonb' })
  ventas: VentaDelPedido[];

  @Column({ type: 'jsonb' })
  mensajes: string[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenciaPago: string | null;

  @Column({ type: 'timestamptz' })
  creadoEn: Date;

  @Column({ type: 'timestamptz' })
  actualizadoEn: Date;
}
