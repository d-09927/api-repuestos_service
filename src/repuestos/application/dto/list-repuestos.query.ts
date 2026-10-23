export interface ListRepuestosQuery {
  texto?: string;
  marca?: string;
  categoria?: string;
  vehiculoMarca?: string;
  vehiculoModelo?: string;
  vehiculoAnio?: number;
  incluirInactivos?: boolean;
  pagina: number;
  limite: number;
}
