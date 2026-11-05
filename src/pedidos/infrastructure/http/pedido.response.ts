import { Pedido } from '../../domain/entities/pedido.entity';

export function toPedidoResponse(p: Pedido) {
  return {
    id: p.id,
    codigoOrden: p.codigoOrden,
    vin: p.vin,
    estado: p.estado,
    lineas: p.lineas,
    ventas: p.ventas,
    referenciaPago: p.referenciaPago,
    creadoEn: p.creadoEn,
    actualizadoEn: p.actualizadoEn,
  };
}
