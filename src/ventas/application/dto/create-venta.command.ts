/** El precio no se envía: se toma del catálogo en el momento de la venta. */
export interface LineaVentaRegistroCommand {
  repuestoId: string;
  cantidad: number;
}

export interface CreateVentaCommand {
  /** Opcional: una venta de mostrador puede no tener cliente. */
  clienteId?: string;
  /** Bodega de la que salen los repuestos. Si no se indica, PRINCIPAL. */
  bodega?: string;
  observaciones?: string;
  lineas: LineaVentaRegistroCommand[];
}

/** Opciones que no llegan por HTTP: las usa el módulo de pedidos al entregar una orden de taller. */
export interface OpcionesVenta {
  /** La venta queda por cobrar (PENDIENTE_PAGO) en lugar de pagada. */
  pendienteDePago?: boolean;
  /** Las unidades salen de lo que estaba reservado para el pedido, no de lo disponible. */
  desdeReserva?: boolean;
}
