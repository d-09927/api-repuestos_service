export interface ListVentasQuery {
  clienteId?: string;
  /** AAAA-MM-DD (hora Colombia) o fecha-hora ISO completa. */
  desde?: string;
  hasta?: string;
  pagina: number;
  limite: number;
}
