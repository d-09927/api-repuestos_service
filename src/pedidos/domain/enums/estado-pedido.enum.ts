/**
 * APARTADO → ENTREGADO → PAGADO, o APARTADO → CANCELADO.
 * Un pedido cancelado puede volver a apartarse para la misma orden.
 */
export enum EstadoPedido {
  APARTADO = 'APARTADO',
  ENTREGADO = 'ENTREGADO',
  PAGADO = 'PAGADO',
  CANCELADO = 'CANCELADO',
}
