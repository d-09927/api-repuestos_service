export interface RepuestoDeCodigo {
  id: string;
  sku: string;
  nombre: string;
  /** Precio de catálogo, con IVA. */
  precio: number;
}

/** PUERTO hacia el módulo de repuestos: las marcas activas que tienen un código universal. */
export abstract class RepuestoServicePort {
  abstract porCodigoUniversal(codigo: string): Promise<RepuestoDeCodigo[]>;
}
