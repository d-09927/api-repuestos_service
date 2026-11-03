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

export interface ApartarPedidoCommand extends ConOrden {
  lineas: LineaCodigoCommand[];
}

export interface EntregarPedidoCommand extends ConOrden {
  /** Lo que realmente usó el taller. Lo que no venga se toma como 0 usados (vuelve a disponible). */
  usadas: LineaCodigoCommand[];
}

export interface CancelarPedidoCommand extends ConOrden {
  motivo?: string;
}

export interface PagarPedidoCommand extends ConOrden {
  referenciaPago: string;
}
