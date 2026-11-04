/**
 * Entidad de dominio: un chat de Telegram y la conversación del agente que le corresponde.
 * Guarda también quién escribió por última vez, para saber de quién es cada conversación.
 */
export class TelegramChat {
  /** Id del chat en Telegram (texto: los ids pueden superar el entero de 32 bits). */
  chatId: string;
  /** Null cuando el cliente pidió /nueva: el próximo mensaje empieza una conversación de cero. */
  conversacionId: string | null;
  usuarioId: string;
  usuarioNombre: string;
  actualizadoEn: Date;

  constructor(datos: TelegramChat) {
    Object.assign(this, datos);
  }
}
