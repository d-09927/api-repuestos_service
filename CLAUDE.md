# CLAUDE.md — Servicio de repuestos

Servicio del sector **repuestos** de una concesionaria de carros (catálogo, stock, proveedores, clientes,
compras y ventas). Es el primero de varios microservicios por sector (luego contabilidad, taller y
concesionario), cada uno con su API, su base de datos, su MCP y su agente.

Stack: NestJS 11, PostgreSQL, TypeORM 0.3, **zod 4 + nestjs-zod** para validar, jest. El proyecto es CommonJS
(imports relativos sin `.js`). Idioma del código, comentarios y respuestas: español.

## Comandos

```bash
cp .env.example .env
docker compose up -d postgres     # Postgres en Docker (si el 5432 está ocupado, cambia DB_PORT en .env)
npm install
npm run start:dev                 # API en http://localhost:3000/api · Swagger en /docs
npm test                          # tests de los services, sin base de datos
npm run build
```

- Para empezar con la base de datos limpia: `docker compose down -v` y volver a levantarla.
- `DB_SYNCHRONIZE=true` crea las tablas solas (solo desarrollo). Producción: migraciones y las dos
  secuencias `compras_consecutivo_seq` / `ventas_consecutivo_seq`.
- El detalle de endpoints, tablas y reglas está en `README.md`.

## Arquitectura (no romper estas reglas)

Un **módulo por tabla**, sin mezclar lógica ni tablas. Los once módulos: `repuestos`, `compatibilidades`,
`stock`, `movimientos`, `proveedores`, `clientes`, `compras`, `compra-detalles`, `ventas`, `venta-detalles`, `pedidos`
(sus líneas van en jsonb dentro de `pedidos`). Además `ia/`, `agente/` (con su tabla `agente_mensajes`) y `bitacora/`
(tabla `mcp_bitacora`: cada llamada al MCP). El monitor es `public/monitor.html` (en `/monitor.html`, solo GET).

```
src/<modulo>/
  <modulo>.module.ts
  application/   <modulo>.service.ts (casos de uso y reglas) + dto/ (commands, queries, results) + *.service.spec.ts
  domain/        entities/ (solo datos) · ports/ · enums/ · errors/
  infrastructure/ adapters/ (*.typeorm.repository.ts, *.local.adapter.ts) · entities/ (*.orm-entity.ts) · http/ (controller, dto zod, *.response.ts)
```

- Las **entidades de dominio son clases planas** (campos + constructor con `Object.assign`). Sin lógica.
- Las **reglas de negocio viven en los services**. Los controladores son delgados: reciben, llaman al
  service y responden. Nunca ponen lógica.
- Los **puertos son clases abstractas** (sirven de token de inyección). Un módulo nunca usa el
  repositorio ni la tabla de otro: pide lo que necesita por un puerto (`*.service.port.ts`) que
  implementa un `*.local.adapter.ts`. Si un módulo pasa a ser otro servicio, se cambia por un `*.http.adapter.ts`.
- Los DTO HTTP son esquemas **zod** (`.strict()` en los de creación) en `infrastructure/http/dto`.
- Relaciones `@ManyToOne` / `@OneToMany` solo en las entidades ORM (capa de infraestructura). Entre sectores
  distintos no habrá llaves foráneas: se hablan por HTTP o eventos.
- Errores de negocio: `ValidationDomainError` → 400, `NotFoundError` → 404, `ConflictError` → 409
  (`common/domain-exception.filter.ts`).
- **Dinero en centavos enteros** (`common/dinero.ts`). Números de documento C-000001 / V-000001 salen de
  secuencias de Postgres.
- **Transacciones entre módulos**: `common/unidad-de-trabajo` (`UnidadDeTrabajoPort`). El stock se mueve con
  bloqueos `pessimistic_write` y, si el documento no se guarda, se revierte (compensación).
- Cada service nuevo lleva su `*.service.spec.ts` con repositorios en memoria (sin base de datos).

## MCP (puerta de entrada para agentes)

Se construye **como la Panadería La Espiga**: el MCP vive *dentro* de la API, como módulo `src/mcp/`, y llama a
los **services** de los demás módulos (no a HTTP ni a las tablas). Referencia local, solo lectura:
`C:\Users\jwilm\OneDrive\Documents\COMPLEMENTARIO-IA\ia-sena\espiga-pro\src\mcp\`.

```
src/mcp/
  mcp.module.ts        importa los módulos cuyos services usa
  mcp.controller.ts    @Controller('mcp'); token Bearer (MCP_TOKEN); createMcpHandler + toNodeHandler
  herramientas.ts      crearServidorMcp(servicios, opciones): un McpServer por petición
  herramientas/        un archivo por dominio: repuestos, stock, personas, documentos, escritura
```

- SDK v2: `@modelcontextprotocol/server` y `@modelcontextprotocol/node` (tiene build CommonJS). `inputSchema: z.object({...})`.
- 17 herramientas de **lectura** siempre (incluye `hablar_con_repuestos`, la puerta de los otros agentes, `consultar_precio_repuesto`, `catalogo_repuestos` y `consultar_orden`); 8 de **escritura** solo si `MCP_PERMITIR_ESCRITURA=true`: reservar, liberar,
  vender y comprar exigen `confirmado: true` (con `false` devuelven un resumen); las 3 de pedidos (despachar, cancelar,
  pagar) no, porque la confirmación viene de facturación, pero exigen `id_mensaje`.
- Los errores se devuelven como resultado `isError` con un mensaje legible, no como excepción.
- Cada llamada queda en la bitácora: `conBitacora` (`src/mcp/bitacora.ts`) envuelve `registerTool` antes de registrar
  las herramientas, así que una herramienta nueva se registra sola. Llamante: `EXTERNO`, `AGENTE` (cabecera
  `X-Llamante: agente-repuestos`, solo etiqueta) o `AUTOMAX`. `GET /api/bitacora`.
- `ComprasModule` y `VentasModule` deben exportar su service (`exports: [...]`) para que el MCP los use.
- Variables: `MCP_TOKEN` (sin él, `/mcp` responde 503) y `MCP_PERMITIR_ESCRITURA`.
- Probar con `npx @modelcontextprotocol/inspector` (Streamable HTTP, `http://localhost:3000/mcp`, cabecera
  `Authorization: Bearer <MCP_TOKEN>`).

## Estado y pendientes (rama `feature/mcp-repuestos`)

1. ✅ Carpeta vieja `mcp-repuestos/` borrada y deshechos los cambios de `tsconfig*.json` y `.dockerignore`.
2. ✅ `src/mcp/` funcionando dentro de la API en `/mcp` (excluido del prefijo `/api` en `main.ts`).
3. ✅ Prueba de punta a punta: `test/mcp.e2e-spec.ts`, se corre con `npm run test:mcp` con la API levantada
   (`MCP_TOKEN=dev-mcp-token`, `MCP_PERMITIR_ESCRITURA=true`). Usa `@modelcontextprotocol/client` (devDependency).
4. **Agente** (en código, sin n8n). Hecho: `src/ia/` (`IaService`, API compatible con OpenAI con `tools`) y
   `src/agente/` (bucle con `MAX_VUELTAS`, cliente MCP por HTTP contra `/mcp`, memoria en la tabla `agente_mensajes`
   con `conversacionId`) en `POST /api/agente/mensajes`. Modelo: Ollama `qwen3.5-agente` (`ollama/Modelfile`,
   `num_ctx 16384`; con 4096 la respuesta llega cortada). Solo modo **cliente** (compra directa → venta PAGADA).
   Falta: modo **facturación** (cotizaciones, venta PENDIENTE_PAGO → DESPACHADA → PAGADA, referencia de la orden,
   token por llamante) y la comunicación por **HTTP** con los agentes de los otros equipos.
5. **Integración con facturación** (contratos de los otros equipos: ver memoria / `docs/contrato-repuestos.xlsx`).
   Fase 1 hecha: `repuestos.codigoUniversal` (código universal del taller, no único), herramienta MCP
   `consultar_precio_repuesto` (el catálogo guarda precios CON IVA; `precio_unitario` sale SIN IVA, como lo pide facturación), `npm run sembrar:codigos`.
   **Requisito: todo entre sectores pasa por agentes.** Los otros sectores llaman `hablar_con_repuestos` (MCP) →
   `AgenteService.responder(texto, id, 'agente')`: prompt `PROMPT_AGENTES`, solo `HERRAMIENTAS_ENTRE_AGENTES` (consulta),
   y `datos[]` sale de los resultados de `consultar_precio_repuesto`, no del texto del modelo. El agente nunca ve su
   propia puerta (`PUERTA_DEL_AGENTE`).
   Fase 2 hecha: módulo `pedidos`. Cuando el cliente acepta la cotización, `despachar_orden` aparta y despacha en un
   solo paso: pedido DESPACHADO y venta PENDIENTE_PAGO; facturación paga con `registrar_pago_orden` (PAGADO), por el
   agente. APARTADO es transitorio (venta fallida a medias o pedido viejo: despachar lo termina, `cancelar_orden` lo
   libera); un DESPACHADO no se cancela. También `consultar_orden`; `ventas.estado` (PAGADA / PENDIENTE_PAGO)
   y `marcarPagada`; comprador = facturación (`FACTURACION_NIT`). En modo agente el código fija `codigo_orden` e
   `id_mensaje` (`<id del mensaje>:<herramienta>`). Pendiente: que facturación deje el REST directo y cerrarlo (auth).
   **AutoMax (concesionario), garantías:** herramienta `consultar_compras_vin`, visible **solo** con `MCP_TOKEN_AUTOMAX`
   (16+ caracteres; ese token no ve nada más y el general no la ve). Es la excepción a "todo por agentes": debe responder
   en menos de 3 s. `ventas.vin` y `ventas.codigoOrden`; `venta_detalles` copia `codigoUniversal` y `categoria`.
   `GET /api/salud` sin token. En modo agente el VIN lo fija el código desde `hablar_con_repuestos { vin }`.
   Venta de prueba: `npm run sembrar:garantia`.
6. Más adelante: anulaciones y devoluciones, autenticación y roles, eventos entre servicios
   (`stock.bajo`, `venta.confirmada`) y agentes de los otros sectores coordinados por un agente superior.

## Cómo trabajar aquí

- Antes de crear algo, mira cómo lo hace un módulo existente (por ejemplo `clientes` o `proveedores`) y copia esa forma.
- Trabaja sobre este proyecto; no crees proyectos nuevos ni entregues zips.
- No hagas commit directo a `main`; usa ramas.
- Si una decisión cambia la estructura (carpetas, nombres, dónde va la lógica), pregunta antes.
