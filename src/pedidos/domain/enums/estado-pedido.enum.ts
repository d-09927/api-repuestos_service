/**
 * DESPACHADO → PAGADO. Cuando el cliente acepta la cotización, el pedido se aparta y se despacha en
 * un solo paso: queda DESPACHADO con su venta PENDIENTE_PAGO, y facturación la paga después.
 * APARTADO es transitorio (reservado mientras se generan las ventas, o un pedido de antes de este
 * flujo): despachar lo termina y cancelar lo libera. Un pedido cancelado puede volver a despacharse.
 */
export enum EstadoPedido {
  APARTADO = 'APARTADO',
  DESPACHADO = 'DESPACHADO',
  PAGADO = 'PAGADO',
  CANCELADO = 'CANCELADO',
}
