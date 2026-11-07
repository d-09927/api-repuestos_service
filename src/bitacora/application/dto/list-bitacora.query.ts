import { Llamante } from '../../domain/enums/llamante.enum';

export interface ListBitacoraQuery {
  herramienta?: string;
  llamante?: Llamante;
  soloErrores?: boolean;
  /** AAAA-MM-DD (hora Colombia) o fecha-hora ISO. */
  desde?: string;
  /** AAAA-MM-DD incluye todo ese día. */
  hasta?: string;
  pagina: number;
  limite: number;
}
