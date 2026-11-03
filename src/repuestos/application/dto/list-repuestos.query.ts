export interface ListRepuestosQuery {
  texto?: string;
  codigoUniversal?: string;
  marca?: string;
  categoria?: string;
  vehiculoMarca?: string;
  vehiculoModelo?: string;
  vehiculoAnio?: number;
  incluirInactivos?: boolean;
  pagina: number;
  limite: number;
}
