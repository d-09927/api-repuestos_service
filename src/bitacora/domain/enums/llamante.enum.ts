/** Quién llamó al MCP. */
export enum Llamante {
  /** Nuestro propio agente (AgenteService), que usa el MCP para responder. */
  AGENTE = 'AGENTE',
  /** Cualquiera con el token general: los agentes de otros sectores, el inspector, pruebas. */
  EXTERNO = 'EXTERNO',
  /** AutoMax con su token propio (solo consultar_compras_vin). */
  AUTOMAX = 'AUTOMAX',
}
