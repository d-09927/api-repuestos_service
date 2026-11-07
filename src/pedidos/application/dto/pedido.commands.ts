export interface LineaCodigoCommand {
  /** Código universal del repuesto (PAS-DEL-CER). */
  codigoUniversal: string;
  cantidad: number;
}

interface ConOrden {
  /** Código de la orden de taller (OT-0054). */
  codigoOrden: string;
  /** Identificador único de la intención: un reintento con el mismo no repite la acción. */
  idMensaje: string;
}

/** El cliente aceptó la cotización: se aparta y se despacha (venta por cobrar) en un solo paso. */
export interface DespacharPedidoCommand extends ConOrden {
  /** VIN del vehículo de la orden: pasa a la venta (garantía de AutoMax). */
  vin?: string | null;
  lineas: LineaCodigoCommand[];
}

export interface CancelarPedidoCommand extends ConOrden {
  motivo?: string;
}

export interface PagarPedidoCommand extends ConOrden {
  referenciaPago: string;
}
