/**
 * Un repuesto del catálogo disponible: uno por código universal, aunque lo tengamos en varias
 * marcas o bodegas. Es lo que el taller puede pedir con ese código.
 */
export interface ItemCatalogo {
  codigoUniversal: string;
  /** Nombre genérico (sin la marca). */
  nombre: string;
  categoria: string;
  /** Marcas que tenemos con unidades disponibles, de la más barata a la más cara. */
  marcas: string[];
  /** Suma de lo disponible (físico menos reservado) en todas las marcas y bodegas. */
  unidadesDisponibles: number;
  /** Precio de catálogo (con IVA) de la marca más barata. */
  precioDesde: number;
  bodegas: string[];
}
