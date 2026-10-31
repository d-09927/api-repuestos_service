export interface CompatibilidadCommand {
  marca: string;
  modelo: string;
  anioDesde: number;
  anioHasta: number;
}

export interface CreateRepuestoCommand {
  sku: string;
  codigoUniversal?: string | null;
  nombre: string;
  descripcion?: string;
  marca: string;
  categoria: string;
  precio: number;
  compatibilidad?: CompatibilidadCommand[];
}
