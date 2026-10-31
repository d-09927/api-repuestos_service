import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NotFoundError } from '../../common/domain-error';
import { IaService, Mensaje } from '../../ia/ia.service';
import { MensajeConversacion } from '../domain/entities/mensaje-conversacion.entity';
import { ConversacionRepositoryPort } from '../domain/ports/conversacion.repository.port';
import { McpClienteService, SesionMcp } from './mcp-cliente.service';
import { PROMPT_CLIENTE } from './prompts';

/** Máximo de idas y vueltas con el modelo por mensaje; evita bucles infinitos si el modelo se enreda. */
export const MAX_VUELTAS = 6;

/** Mensajes anteriores que ve el modelo. Más memoria ocupa más contexto (ver num_ctx en ollama/Modelfile). */
export const LIMITE_HISTORIAL = 30;

const SIN_RESPUESTA = 'No tengo una respuesta para eso. ¿Me lo puede decir de otra forma?';
const SIN_TERMINAR = 'No pude completar la consulta. Intente con una pregunta más concreta.';

export interface RespuestaAgente {
  /** Se envía en los siguientes mensajes para continuar la misma conversación. */
  conversacionId: string;
  respuesta: string;
  /** Herramientas que usó, en orden. Sirve para depurar y para auditar lo que hizo el agente. */
  herramientas: string[];
}

@Injectable()
export class AgenteService {
  private readonly logger = new Logger('Agente');

  constructor(
    private readonly ia: IaService,
    private readonly mcp: McpClienteService,
    private readonly conversaciones: ConversacionRepositoryPort,
  ) {}

  /** Sin conversacionId empieza una conversación nueva; con él, continúa la anterior. */
  async responder(texto: string, conversacionId?: string): Promise<RespuestaAgente> {
    const id = conversacionId ?? randomUUID();
    const { anteriores, ultimoOrden } = conversacionId
      ? await this.historial(conversacionId)
      : { anteriores: [], ultimoOrden: 0 };

    const mensajes: Mensaje[] = [
      { role: 'system', content: PROMPT_CLIENTE },
      ...anteriores.map(aMensajeModelo),
      { role: 'user', content: texto },
    ];
    // Desde aquí, todo lo que se agregue a `mensajes` es nuevo y se guardará.
    const inicioNuevos = mensajes.length - 1;
    const usadas: string[] = [];

    const sesion = await this.mcp.abrir();
    let respuesta: string;
    try {
      respuesta = await this.bucle(mensajes, sesion, usadas);
    } finally {
      await sesion.cerrar();
    }
    mensajes.push({ role: 'assistant', content: respuesta });

    // Se guarda solo si hubo respuesta: si el modelo falla, el cliente reintenta sin dejar la conversación a medias.
    const ahora = new Date();
    await this.conversaciones.guardar(
      mensajes.slice(inicioNuevos).map((m, i) => aEntidad(m, id, ultimoOrden + 1 + i, ahora)),
    );
    return { conversacionId: id, respuesta, herramientas: usadas };
  }

  // Los últimos mensajes, empezando siempre en uno del cliente: si la ventana cortara entre un
  // pedido de herramienta y su resultado, el modelo recibiría un resultado sin pedido.
  private async historial(conversacionId: string) {
    if (!(await this.conversaciones.existe(conversacionId))) {
      throw new NotFoundError(`La conversación ${conversacionId} no existe`);
    }
    const ultimos = await this.conversaciones.ultimos(conversacionId, LIMITE_HISTORIAL);
    const inicio = ultimos.findIndex((m) => m.rol === 'user');
    return {
      anteriores: inicio === -1 ? [] : ultimos.slice(inicio),
      ultimoOrden: ultimos.at(-1)?.orden ?? 0,
    };
  }

  // El bucle del agente: el modelo pide herramientas, se ejecutan en el MCP y se le devuelven
  // los resultados, hasta que responde con texto.
  private async bucle(mensajes: Mensaje[], sesion: SesionMcp, usadas: string[]): Promise<string> {
    for (let vuelta = 1; vuelta <= MAX_VUELTAS; vuelta++) {
      const r = await this.ia.completar(mensajes, sesion.herramientas);
      if (r.llamadas.length === 0) return r.texto || SIN_RESPUESTA;

      // El pedido del modelo va a la conversación antes de los resultados: cada resultado
      // se enlaza con su pedido por tool_call_id.
      mensajes.push({ role: 'assistant', content: r.texto || null, tool_calls: r.llamadas });
      for (const llamada of r.llamadas) {
        this.logger.log(`vuelta ${vuelta}: ${llamada.function.name} ${llamada.function.arguments}`);
        usadas.push(llamada.function.name);
        mensajes.push({ role: 'tool', tool_call_id: llamada.id, content: await sesion.ejecutar(llamada) });
      }
    }
    this.logger.warn(`Sin respuesta después de ${MAX_VUELTAS} vueltas: ${usadas.join(', ')}`);
    return SIN_TERMINAR;
  }
}

/** De la tabla al formato del modelo. */
function aMensajeModelo(m: MensajeConversacion): Mensaje {
  switch (m.rol) {
    case 'user':
      return { role: 'user', content: m.contenido ?? '' };
    case 'tool':
      return { role: 'tool', tool_call_id: m.llamadaId ?? '', content: m.contenido ?? '' };
    case 'assistant':
      return m.llamadas
        ? {
            role: 'assistant',
            content: m.contenido,
            tool_calls: m.llamadas.map((l) => ({
              id: l.id,
              type: 'function' as const,
              function: { name: l.nombre, arguments: l.argumentos },
            })),
          }
        : { role: 'assistant', content: m.contenido };
  }
}

/** Del formato del modelo a la tabla. El prompt del sistema no se guarda: se arma en cada mensaje. */
function aEntidad(m: Mensaje, conversacionId: string, orden: number, creadoEn: Date): MensajeConversacion {
  const base = { id: randomUUID(), conversacionId, orden, creadoEn, contenido: null, llamadas: null, llamadaId: null };
  switch (m.role) {
    case 'user':
      return new MensajeConversacion({ ...base, rol: 'user', contenido: m.content });
    case 'tool':
      return new MensajeConversacion({ ...base, rol: 'tool', contenido: m.content, llamadaId: m.tool_call_id });
    case 'assistant':
      return new MensajeConversacion({
        ...base,
        rol: 'assistant',
        contenido: m.content,
        llamadas:
          m.tool_calls?.map((l) => ({ id: l.id, nombre: l.function.name, argumentos: l.function.arguments })) ?? null,
      });
    default:
      throw new Error('El prompt del sistema no se guarda en la conversación');
  }
}
