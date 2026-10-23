export interface ListProveedoresQuery {
  texto?: string;
  incluirInactivos?: boolean;
  pagina: number;
  limite: number;
}
