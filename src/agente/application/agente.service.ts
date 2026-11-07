import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NotFoundError } from '../../common/domain-error';
import { Herramienta, IaService, LlamadaHerramienta, Mensaje } from '../../ia/ia.service';
import { MensajeConversacion } from '../domain/entities/mensaje-conversacion.entity';
import { ConversacionRepositoryPort } from '../domain/ports/conversacion.repository.port';
import { McpClienteService, SesionMcp } from './mcp-cliente.service';
import { PROMPT_AGENTES, PROMPT_CLIENTE } from './prompts';

/** Máximo de idas y vueltas con el modelo por mensaje; evita bucles infinitos si el modelo se enreda. */
export const MAX_VUELTAS = 6;

/** Mensajes anteriores que ve el modelo. Más memoria ocupa más contexto (ver num_ctx en ollama/Modelfile). */
export const LIMITE_HISTORIAL = 30;

/** Quién le habla al agente: una persona (compra directa) o el agente de otro sector (facturación, taller). */
export type ModoAgente = 'cliente' | 'agente';

/** Herramienta MCP por la que los otros agentes le hablan a este. Nunca se le ofrece al propio agente: se llamaría a sí mismo. */
export const PUERTA_DEL_AGENTE = 'hablar_con_repuestos';

/** El pedido de una orden de taller: solo lo maneja el agente cuando le habla otro sector, nunca con un cliente. */
export const HERRAMIENTAS_DE_PEDIDOS = [
  'consultar_orden',
  'despachar_orden',
  'cancelar_orden',
  'registrar_pago_orden',
];

/** Con otros agentes: consultas y el pedido de la orden. Nada de ventas de mostrador ni compras a proveedores. */
export const HERRAMIENTAS_ENTRE_AGENTES = [
  'catalogo_repuestos',
  'consultar_precio_repuesto',
  'disponibilidad_repuestos',
  'buscar_repuestos',
  'buscar_repuestos_por_vehiculo',
  'obtener_repuesto',
  'consultar_stock',
  ...HERRAMIENTAS_DE_PEDIDOS,
];

/** Lo que trae el mensaje del otro sector y el código impone en las herramientas de pedidos (no el modelo). */
export interface ContextoAgente {
  /** Orden de taller del mensaje: el agente no puede actuar sobre otra. */
  codigoOrden?: string;
  /** id_mensaje del otro sector: de él sale el de cada acción, así un reintento no repite nada. */
  idMensaje?: string;
  /** VIN del mensaje: el modelo no puede poner otro, porque decide la garantía del vehículo. */
  vin?: string;
}

const SIN_RESPUESTA = 'No tengo una respuesta para eso. ¿Me lo puede decir de otra forma?';
const SIN_TERMINAR = 'No pude completar la consulta. Intente con una pregunta más concreta.';

export interface RespuestaAgente {
  /** Se envía en los siguientes mensajes para continuar la misma conversación. */
  conversacionId: string;
  respuesta: string;
  /** Herramientas que usó, en orden. Sirve para depurar y para auditar lo que hizo el agente. */
  herramientas: string[];
  /**
   * Solo con otros agentes: el resultado de cada consultar_precio_repuesto que hizo el agente, tal como
   * lo devolvió la herramienta. Los precios nunca salen del texto del modelo, así no se pueden inventar.
   */
  datos?: unknown[];
  /** Solo con otros agentes: el último catalogo_repuestos que consultó el agente, tal como lo devolvió la herramienta. */
  catalogo?: unknown;
  /** Solo con otros agentes: el pedido de la orden tal como quedó tras la última acción (de la herramienta, no del modelo). */
  pedido?: unknown;
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
  async responder(
    texto: string,
    conversacionId?: string,
    modo: ModoAgente = 'cliente',
    contexto: ContextoAgente = {},
  ): Promise<RespuestaAgente> {
    const id = conversacionId ?? randomUUID();
    const { anteriores, ultimoOrden } = conversacionId
      ? await this.historial(conversacionId)
      : { anteriores: [], ultimoOrden: 0 };

    const mensajes: Mensaje[] = [
      { role: 'system', content: modo === 'agente' ? PROMPT_AGENTES : PROMPT_CLIENTE },
      ...anteriores.map(aMensajeModelo),
      { role: 'user', content: texto },
    ];
    // Desde aquí, todo lo que se agregue a `mensajes` es nuevo y se guardará.
    const inicioNuevos = mensajes.length - 1;
    const usadas: string[] = [];

    const sesion = await this.mcp.abrir();
    let respuesta: string;
    try {
      const permitidas = sesion.herramientas.filter((h) => permitida(h, modo));
      const base = contexto.idMensaje?.trim() || randomUUID();
      const ajustar = (l: LlamadaHerramienta) =>
        modo === 'agente' && HERRAMIENTAS_DE_PEDIDOS.includes(l.function.name) ? conContexto(l, contexto, base) : l;
      respuesta = await this.bucle(mensajes, permitidas, sesion, usadas, ajustar);
    } finally {
      await sesion.cerrar();
    }
    mensajes.push({ role: 'assistant', content: respuesta });

    // Se guarda solo si hubo respuesta: si el modelo falla, el cliente reintenta sin dejar la conversación a medias.
    const ahora = new Date();
    await this.conversaciones.guardar(
      mensajes.slice(inicioNuevos).map((m, i) => aEntidad(m, id, ultimoOrden + 1 + i, ahora)),
    );
    const resultado: RespuestaAgente = { conversacionId: id, respuesta, herramientas: usadas };
    if (modo === 'agente') {
      const nuevos = mensajes.slice(inicioNuevos);
      resultado.datos = preciosConsultados(nuevos);
      const catalogos = resultadosDe(nuevos, ['catalogo_repuestos']);
      if (catalogos.length) resultado.catalogo = catalogos.at(-1);
      const pedidos = resultadosDe(nuevos, HERRAMIENTAS_DE_PEDIDOS);
      if (pedidos.length) resultado.pedido = pedidos.at(-1);
    }
    return resultado;
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
  private async bucle(
    mensajes: Mensaje[],
    herramientas: Herramienta[],
    sesion: SesionMcp,
    usadas: string[],
    ajustar: (l: LlamadaHerramienta) => LlamadaHerramienta = (l) => l,
  ): Promise<string> {
    for (let vuelta = 1; vuelta <= MAX_VUELTAS; vuelta++) {
      const r = await this.ia.completar(mensajes, herramientas);
      if (r.llamadas.length === 0) return r.texto || SIN_RESPUESTA;

      // El pedido del modelo va a la conversación antes de los resultados: cada resultado
      // se enlaza con su pedido por tool_call_id.
      // Se guarda la llamada ya ajustada: el modelo ve lo que de verdad se ejecutó.
      const llamadas = r.llamadas.map(ajustar);
      mensajes.push({ role: 'assistant', content: r.texto || null, tool_calls: llamadas });
      for (const llamada of llamadas) {
        this.logger.log(`vuelta ${vuelta}: ${llamada.function.name} ${llamada.function.arguments}`);
        usadas.push(llamada.function.name);
        mensajes.push({ role: 'tool', tool_call_id: llamada.id, content: await sesion.ejecutar(llamada) });
      }
    }
    this.logger.warn(`Sin respuesta después de ${MAX_VUELTAS} vueltas: ${usadas.join(', ')}`);
    return SIN_TERMINAR;
  }
}

function permitida(h: Herramienta, modo: ModoAgente): boolean {
  const nombre = h.function.name;
  if (nombre === PUERTA_DEL_AGENTE) return false;
  if (modo === 'agente') return HERRAMIENTAS_ENTRE_AGENTES.includes(nombre);
  return !HERRAMIENTAS_DE_PEDIDOS.includes(nombre);
}

/**
 * La orden y el id_mensaje de una acción de pedido los pone el código desde el mensaje del otro
 * sector: el modelo no puede tocar otra orden ni inventar un id_mensaje que repita o salte una acción.
 */
function conContexto(l: LlamadaHerramienta, contexto: ContextoAgente, base: string): LlamadaHerramienta {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(l.function.arguments || '{}');
  } catch {
    return l; // el cliente MCP le devolverá al modelo el error de JSON
  }
  if (contexto.codigoOrden) args.codigo_orden = contexto.codigoOrden;
  if (l.function.name !== 'consultar_orden') args.id_mensaje = `${base}:${l.function.name}`;
  if (contexto.vin) args.vin = contexto.vin;
  else delete args.vin;
  return { ...l, function: { ...l.function, arguments: JSON.stringify(args) } };
}

/** Los resultados (JSON, sin ERROR) de las herramientas indicadas en este turno, en orden. */
function resultadosDe(nuevos: Mensaje[], nombres: string[]): Record<string, unknown>[] {
  const ids = new Set<string>();
  for (const m of nuevos) {
    if (m.role !== 'assistant' || !m.tool_calls) continue;
    for (const l of m.tool_calls) if (nombres.includes(l.function.name)) ids.add(l.id);
  }
  const resultados: Record<string, unknown>[] = [];
  for (const m of nuevos) {
    if (m.role !== 'tool' || !ids.has(m.tool_call_id) || m.content.startsWith('ERROR')) continue;
    try {
      resultados.push(JSON.parse(m.content));
    } catch {
      // Un resultado que no es JSON no es un dato: no se adjunta.
    }
  }
  return resultados;
}

/** Los resultados de consultar_precio_repuesto de este turno (uno por código; si se consultó dos veces, el último). */
function preciosConsultados(nuevos: Mensaje[]): unknown[] {
  const porCodigo = new Map<string, unknown>();
  for (const dato of resultadosDe(nuevos, ['consultar_precio_repuesto'])) porCodigo.set(String(dato.codigo_repuesto), dato);
  return [...porCodigo.values()];
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
