export interface ListClientesQuery {
  texto?: string;
  incluirInactivos?: boolean;
  pagina: number;
  limite: number;
}
