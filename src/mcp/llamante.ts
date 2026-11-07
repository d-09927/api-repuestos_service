/**
 * Cabecera con la que nuestro agente se identifica al llamar al MCP. Solo etiqueta la bitácora
 * (AGENTE en vez de EXTERNO); no da ningún permiso: el acceso lo decide el token.
 */
export const CABECERA_LLAMANTE = 'x-llamante';
export const AGENTE_PROPIO = 'agente-repuestos';
