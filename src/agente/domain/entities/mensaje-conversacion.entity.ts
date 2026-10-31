export type RolMensaje = 'user' | 'assistant' | 'tool';

/** Una herramienta que el modelo pidió ejecutar. `argumentos` es el JSON en texto, tal como lo envió. */
export interface LlamadaGuardada {
  id: string;
  nombre: string;
  argumentos: string;
}

/**
 * Entidad de dominio: un mensaje de una conversación con el agente. Se guardan todos, también
 * los pedidos de herramientas y sus resultados: al confirmar una venta el modelo necesita los ids
 * exactos que usó en el resumen. Las reglas están en AgenteService.
 */
export class MensajeConversacion {
  id: string;
  conversacionId: string;
  /** Posición dentro de la conversación (1, 2, 3...). */
  orden: number;
  rol: RolMensaje;
  /** Texto del cliente, del agente o resultado de una herramienta. Null si el agente solo pidió herramientas. */
  contenido: string | null;
  /** Solo en mensajes 'assistant' que piden herramientas. */
  llamadas: LlamadaGuardada[] | null;
  /** Solo en mensajes 'tool': el id de la llamada a la que responde. */
  llamadaId: string | null;
  creadoEn: Date;

  constructor(datos: MensajeConversacion) {
    Object.assign(this, datos);
  }
}
