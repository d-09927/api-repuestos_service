/** Una venta de mostrador se paga en el momento; la de un pedido de otro sector queda por cobrar. */
export enum EstadoVenta {
  PAGADA = 'PAGADA',
  PENDIENTE_PAGO = 'PENDIENTE_PAGO',
}
