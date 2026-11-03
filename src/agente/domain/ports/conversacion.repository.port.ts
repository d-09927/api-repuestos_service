import { MensajeConversacion } from '../entities/mensaje-conversacion.entity';

/** PUERTO de salida: guardar y leer las conversaciones del agente. La implementación vive en infrastructure/adapters. */
export abstract class ConversacionRepositoryPort {
  abstract existe(conversacionId: string): Promise<boolean>;
  /** Los últimos `limite` mensajes, del más antiguo al más reciente. */
  abstract ultimos(conversacionId: string, limite: number): Promise<MensajeConversacion[]>;
  /** Guarda todos o ninguno. Lanza ConflictError si otro mensaje ya ocupó el mismo orden. */
  abstract guardar(mensajes: MensajeConversacion[]): Promise<void>;
}
