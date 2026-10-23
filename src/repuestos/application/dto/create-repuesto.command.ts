export interface CompatibilidadCommand {
  marca: string;
  modelo: string;
  anioDesde: number;
  anioHasta: number;
}

export interface CreateRepuestoCommand {
  sku: string;
  nombre: string;
  descripcion?: string;
  marca: string;
  categoria: string;
  precio: number;
  compatibilidad?: CompatibilidadCommand[];
}
