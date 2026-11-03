/** PUERTO hacia el módulo de clientes. */
export abstract class ClienteServicePort {
  /** Id del cliente que compra los repuestos de las órdenes de taller (facturación). Si no existe, se crea. */
  abstract comprador(): Promise<string>;
}
