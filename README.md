# Servicio de repuestos

Servicio del sector **repuestos** de la concesionaria: repuestos, stock, proveedores, clientes,
compras y ventas. NestJS + PostgreSQL + TypeORM + zod. Es el primero de los servicios por sector
(luego vendrán contabilidad, taller y concesionario, cada uno con su propia base de datos).

## Cómo correrlo

```bash
cp .env.example .env
docker compose up -d postgres     # Postgres en Docker
npm install
npm run start:dev                 # API en http://localhost:3000/api
```

- Swagger (probar los endpoints desde el navegador): http://localhost:3000/docs
- Tests de los services: `npm test`
- Pruebas de la API con Postman: carpeta `postman/` (ver abajo)
- Todo en contenedores: `docker compose --profile app up --build`
- Si el puerto 5432 ya está ocupado en tu máquina, cambia `DB_PORT` en `.env`.

## Pruebas con Postman

1. Levanta la API (`npm run start:dev`).
2. En Postman: **Import** → `postman/repuestos-service.postman_collection.json`.
3. Clic derecho en la colección → **Run collection** → **Run**. Se ejecuta todo en orden y cada petición
   trae sus propias verificaciones (pestaña *Tests*).

El flujo crea repuesto, proveedor y cliente, compra 10, vende 3, comprueba que el stock queda en 7 y que
los movimientos y números `C-` / `V-` son correctos. Luego prueba los errores (409 por stock insuficiente
o SKU repetido, 400 por datos inválidos, 404) y las operaciones de stock. Los ids se guardan solos en
variables de la colección y los datos son únicos en cada corrida, así que se puede repetir. La URL base
es la variable `baseUrl` (`http://localhost:3000/api`); si cambias el puerto, edítala en la pestaña
*Variables* de la colección.

## MCP para agentes

El módulo `src/mcp/` expone los services como herramientas MCP en `POST /mcp` (Streamable HTTP), con
cabecera `Authorization: Bearer <MCP_TOKEN>`. Sin `MCP_TOKEN` responde 503. Hay 17 herramientas de lectura;
las 4 de escritura (reservar, liberar, vender, comprar) solo aparecen con `MCP_PERMITIR_ESCRITURA=true` y
exigen `confirmado: true`.

- Probar a mano: `npx @modelcontextprotocol/inspector` → Streamable HTTP → `http://localhost:3000/mcp`.
- Prueba automática de punta a punta (API levantada con escritura habilitada): `npm run test:mcp`.

### Para los otros sectores: `hablar_con_repuestos`

Requisito del proyecto: **la comunicación entre sectores pasa por los agentes**. Los agentes de facturación o del
taller le escriben al nuestro con `hablar_con_repuestos { mensaje, codigo_orden?, conversacion_id?, id_mensaje? }` y
nuestro agente decide qué consultar. Responde `{ conversacion_id, respuesta, datos[], catalogo, pedido, herramientas_usadas[] }`:
`respuesta` es el texto del agente y `datos[]` trae el resultado de cada `consultar_precio_repuesto` que hizo, tal cual
(los precios nunca salen del texto del modelo). Tarda 10–25 s con el modelo local.

Por el mismo mensaje el agente maneja el **pedido de una orden de taller** (módulo `pedidos`, `GET /api/pedidos`):

| Mensaje del otro sector | Herramienta que usa el agente | Estado |
|---|---|---|
| "El cliente aceptó: aparta 2 AMO-DEL-GAS" | `apartar_para_orden` (reserva; marca más barata que alcance en una bodega) | APARTADO |
| "Terminamos: se usaron 2 AMO-DEL-GAS" | `entregar_orden` (venta **por cobrar** a facturación de lo usado; libera el sobrante) | ENTREGADO |
| "Pagamos, referencia PSE-123" | `registrar_pago_orden` (las ventas pasan a PAGADA) | PAGADO |
| "Cancela el pedido" | `cancelar_orden` (libera todo) | CANCELADO |

`codigo_orden` e `id_mensaje` los pone el código desde el mensaje (no el modelo): un reintento con el mismo
`id_mensaje` no repite la acción. El comprador es facturación (`FACTURACION_NIT`, `FACTURACION_NOMBRE`). En modo
cliente el agente no ve estas herramientas. Las ventas tienen `estado`: PAGADA (mostrador) o PENDIENTE_PAGO.

### Catálogo para el taller: `catalogo_repuestos` y `GET /api/stock/catalogo`

Lo que hay en las bodegas, **una vez por código universal** (sin repetir marcas ni bodegas), para que el taller sepa qué
puede pedir. Solo sale lo que tiene unidades disponibles (físico menos reservado), está activo y tiene código universal.
Filtro opcional `categoria`. REST: `{ codigoUniversal, nombre (sin marca), categoria, marcas[], unidadesDisponibles,
precioDesde (CON IVA, el del catálogo), bodegas[] }`. MCP: `{ codigo_repuesto, nombre, categoria, marcas,
unidades_disponibles, precio_desde (SIN IVA) }`. El taller lo pide por mensaje ("¿Qué repuestos de frenos tienen?") y
`hablar_con_repuestos` lo devuelve en `catalogo`, tal como salió de la herramienta.

### Garantías de AutoMax: `consultar_compras_vin` y `GET /api/salud`

AutoMax (concesionario) pregunta si se vendió un repuesto de un componente para un vehículo; si es así, la garantía no
aplica. Se conecta a `/mcp` con su propio token (`MCP_TOKEN_AUTOMAX`, 16 caracteres o más), que **solo** ve esta
herramienta; el token general no la ve. No pasa por el agente porque debe responder en menos de 3 s.

- Entrada: `{ vin, categoria, codigo_repuesto? }`, con `categoria` en `frenos | suspension | motor | electrico | transmision`.
- Salida: `{ compras: [{ fecha (ISO -05:00), codigo_repuesto, categoria, descripcion, cantidad, origen, codigo_orden }] }`,
  máximo 100, las más recientes primero. Sin datos personales. VIN mal formado o categoría desconocida: `isError`.
- Las categorías del catálogo se convierten quitando mayúsculas y tildes (`Suspensión` → `suspension`). `Filtros` y
  `Lubricantes` no son componentes de garantía: no salen.
- Las ventas guardan `vin` (opcional en `POST /api/ventas` y en `registrar_venta`). En una orden de taller se envía en
  `hablar_con_repuestos { vin }` al apartar o entregar. **Una venta sin VIN no cuenta para la garantía.**
- `GET /api/salud` responde `{"estado":"ok"}` sin token. Venta de prueba de REL-1006: `npm run sembrar:garantia`.

### La herramienta que usa el agente: `consultar_precio_repuesto`

Facturación (otro grupo) cotiza con los **códigos universales** del taller (`PAS-DEL-CER`, `AMO-DEL-GAS`…), no con
nuestro SKU. Cada repuesto puede tener un `codigoUniversal` (no es único: varias marcas comparten código).
`consultar_precio_repuesto { codigo_repuesto, cantidad }` responde `tienda`, `precio_unitario` (COP entero **sin IVA**,
como lo pide facturación; nuestro catálogo guarda el precio con IVA), `precio_unitario_con_iva`, `iva_unitario`, `disponible`, las bodegas y las marcas alternativas. Configuración:
`TIENDA_NOMBRE` e `IVA_PORCENTAJE` (19). El contrato que se les entrega está en `docs/contrato-repuestos.xlsx`.

Para cargar los 15 códigos universales del taller con stock de prueba (con la API levantada):
`npm run sembrar:codigos` (se puede repetir; no duplica).

## Agente de repuestos

`POST /api/agente/mensajes` con `{ "texto": "..." }` conversa con un cliente: consulta repuestos y existencias y
registra ventas (siempre con un resumen previo y la confirmación del cliente). La respuesta trae un
`conversacionId`; envíelo en los siguientes mensajes para continuar la misma conversación (se guarda en la tabla
`agente_mensajes`). El agente usa las herramientas del MCP por HTTP, así que necesita `MCP_TOKEN`,
`MCP_PERMITIR_ESCRITURA=true` y las variables `IA_*` / `AGENTE_*` de `.env.example`.

Con Ollama local hay que crear antes el modelo con más contexto: `ollama create qwen3.5-agente -f ollama/Modelfile`.

## Un módulo por tabla

| Módulo | Tabla |
|---|---|
| `repuestos` | `repuestos` |
| `compatibilidades` | `compatibilidades` (vehículos con los que sirve cada repuesto) |
| `stock` | `stock` (existencias por repuesto y bodega) |
| `movimientos` | `movimientos` (historial de cada entrada, salida, reserva y ajuste) |
| `proveedores` | `proveedores` |
| `clientes` | `clientes` |
| `compras` | `compras` (cabecera) |
| `compra-detalles` | `compra_detalles` (líneas de la compra) |
| `ventas` | `ventas` (cabecera) |
| `venta-detalles` | `venta_detalles` (líneas de la venta) |

Cada módulo es dueño de **una** tabla y de su lógica. Las tablas se relacionan con llaves foráneas
(`@ManyToOne` / `@OneToMany` en las entidades ORM, `infrastructure/entities`):

```
repuestos 1──* compatibilidades      proveedores 1──* compras 1──* compra_detalles *──1 repuestos
repuestos 1──* stock                 clientes    1──* ventas  1──* venta_detalles  *──1 repuestos
repuestos 1──* movimientos
```

Las relaciones solo existen en esa capa: a nivel de código, cada módulo le pide al otro lo que
necesita a través de un puerto y nunca usa su repositorio ni su tabla. Con otro sector (taller,
contabilidad...) no habrá llaves foráneas: esos se hablan por HTTP o eventos.

## Estructura de carpetas (igual en los diez módulos)

```
src/
  common/                          errores de negocio, filtro HTTP, paginación, dinero, fechas
    unidad-de-trabajo/             transacciones que atraviesan varios módulos
  <modulo>/
    <modulo>.module.ts             conecta puertos con adaptadores
    application/
      <modulo>.service.ts          casos de uso y reglas de negocio + su test (*.service.spec.ts)
      dto/                         create-*.command.ts, update-*.command.ts, *.query.ts, *.result.ts
    domain/
      entities/                    una entidad por archivo: solo los datos (sin lógica, sin Nest ni TypeORM)
      enums/                       enums del dominio
      errors/                      errores propios del dominio
      ports/                       *.repository.port.ts  (guardar/leer datos)
                                   *.service.port.ts     (hablar con otro módulo o servicio)
    infrastructure/
      adapters/                    *.typeorm.repository.ts  (implementa el puerto con Postgres)
                                   *.local.adapter.ts       (llama a otro módulo del mismo proceso)
      entities/                    *.orm-entity.ts  (la tabla de TypeORM)
      http/
        <modulo>.controller.ts     solo HTTP: recibe, llama al service, responde
        *.response.ts              convierte entidades a JSON
        dto/                       esquemas zod: create-*.dto.ts, update-*.dto.ts, list-*.query.dto.ts
```

Cómo se lee:

1. **`domain/entities`**: solo describen los datos (campos y constructor). Sin lógica, sin Nest ni TypeORM.
2. **`domain/ports`**: lo que el módulo necesita del exterior, como clases abstractas (sirven de token de inyección).
3. **`application/*.service.ts`**: los casos de uso y las reglas de negocio (stock que no puede quedar
   negativo, subtotales, unicidad, normalización de textos). Reciben comandos (`application/dto`),
   usan las entidades y los puertos. No saben de HTTP. Se prueban con repositorios en memoria
   (`*.service.spec.ts`), sin base de datos.
4. **`infrastructure/adapters`**: implementan los puertos con Postgres (`*.typeorm.repository.ts`)
   o hablando con otro módulo (`*.local.adapter.ts`).
5. **`infrastructure/http`**: controlador delgado y DTOs. Los DTO son esquemas **zod**: validan el
   formato del cuerpo y de los query params, y Swagger los documenta (con `nestjs-zod`).

### Cómo se conectan los módulos

```
repuestos ───► compatibilidades              (compatibilidad.service.port)
stock ───────► repuestos, movimientos        (repuesto.service.port, movimiento.service.port)
compras ─────► compra-detalles, proveedores, repuestos, stock
ventas ──────► venta-detalles,  clientes,    repuestos, stock
```

Cuando existan los servicios de taller, contabilidad y concesionario (o si algún módulo se separa),
se agrega un `*.http.adapter.ts` que llama al otro servicio por HTTP y se cambia el provider en el
módulo: el service y el dominio no se tocan.

## Endpoints (prefijo `/api`)

**Repuestos** (`/repuestos`)

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/repuestos` | Crea un repuesto (con su compatibilidad de vehículos) |
| GET | `/repuestos` | Lista y filtra: `texto`, `marca`, `categoria`, `vehiculoMarca`+`vehiculoModelo`(+`vehiculoAnio`), `pagina`, `limite` |
| GET | `/repuestos/:id` | Detalle |
| PATCH | `/repuestos/:id` | Cambia precio, nombre, compatibilidad... (el SKU no cambia) |
| DELETE | `/repuestos/:id` | Desactiva el repuesto (no se borra, tiene historial) |
| GET | `/repuestos/:repuestoId/compatibilidades` | Vehículos compatibles (módulo `compatibilidades`) |

**Stock** (`/stock`)

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/stock/entradas` | Ingresa unidades a una bodega (opcional: `minimo`, `ubicacion`) |
| POST | `/stock/salidas` | Saca unidades; con `desdeReserva: true` entrega lo reservado |
| POST | `/stock/reservas` | Aparta unidades (p. ej. para una orden de taller) |
| POST | `/stock/reservas/liberar` | Devuelve unidades reservadas a disponible |
| POST | `/stock/ajustes` | Corrige la cantidad física (conteo); exige `motivo` |
| GET | `/stock/repuestos/:repuestoId` | Stock del repuesto en todas las bodegas |
| GET | `/stock/stock-bajo` | Lo que hay que reponer |
| GET | `/stock/movimientos` | Historial (módulo `movimientos`), filtrable por `repuestoId` y `bodega` |

**Proveedores** (`/proveedores`) y **Clientes** (`/clientes`): `POST`, `GET` (con `texto`, `incluirInactivos`,
paginación), `GET /:id`, `PATCH /:id` y `DELETE /:id` (desactiva). El NIT del proveedor y el tipo y
número de documento del cliente no se pueden cambiar. Tipos de documento: `CC`, `CE`, `NIT`, `PASAPORTE`.

**Compras** (`/compras`) y **Ventas** (`/ventas`)

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/compras` | Registra una compra a un proveedor: **suma** las unidades al stock |
| GET | `/compras` | Lista; filtros `proveedorId`, `desde`, `hasta` |
| GET | `/compras/:id` | Detalle con sus líneas |
| GET | `/compras/:compraId/detalles` | Solo las líneas (módulo `compra-detalles`) |
| POST | `/ventas` | Registra una venta: **descuenta** las unidades del stock |
| GET | `/ventas` | Lista; filtros `clienteId`, `desde`, `hasta` |
| GET | `/ventas/:id` | Detalle con sus líneas |
| GET | `/ventas/:ventaId/detalles` | Solo las líneas (módulo `venta-detalles`) |

Ejemplos:

```bash
# Compra: cada línea lleva repuestoId, cantidad y costoUnitario
curl -X POST http://localhost:3000/api/compras -H 'content-type: application/json' -d '{
  "proveedorId": "<id del proveedor>", "numeroFacturaProveedor": "FV-889",
  "lineas": [{ "repuestoId": "<id del repuesto>", "cantidad": 10, "costoUnitario": 6000 }]
}'

# Venta: el precio NO se envía, se toma del catálogo. El cliente y la bodega son opcionales.
curl -X POST http://localhost:3000/api/ventas -H 'content-type: application/json' -d '{
  "clienteId": "<id del cliente>",
  "lineas": [{ "repuestoId": "<id del repuesto>", "cantidad": 2 }]
}'
```

Reglas de compras y ventas:

- Cada documento recibe un número (`C-000001`, `V-000001`) que queda como `referencia` en los
  movimientos de stock.
- La bodega por defecto es `PRINCIPAL`. Fechas de filtro: `AAAA-MM-DD` (hora de Colombia; `hasta`
  incluye todo ese día) o una fecha-hora ISO completa.
- **Todo o nada**: si una línea de la venta no alcanza en stock, se rechaza la venta completa (409)
  y no se descuenta nada.
- La cabecera y sus líneas se guardan en una sola transacción. Si el stock se movió pero el
  documento no se pudo guardar, el stock se devuelve automáticamente.
- El detalle guarda una copia del SKU, el nombre y el precio o costo del momento: cambiar el
  catálogo después no altera lo ya registrado.
- Un documento registrado no se edita ni se borra (todavía no hay anulación).
- No se puede comprar ni vender un repuesto desactivado, ni comprar a un proveedor o vender a un
  cliente desactivado.

Errores: 400 (datos inválidos; con zod el cuerpo trae el detalle de cada campo), 404 (no existe),
409 (duplicado, stock insuficiente, registro desactivado).

## Detalles a tener en cuenta

- **Transacciones entre módulos**: `UnidadDeTrabajoPort` (en `common/unidad-de-trabajo`) abre una
  transacción y todos los repositorios que se usen dentro de ella participan, aunque sean de
  módulos distintos. Así `stock` + `movimientos` o `compras` + `compra-detalles` se guardan juntos.
- **Concurrencia**: cada movimiento de stock bloquea las filas (`SELECT ... FOR UPDATE`), así dos
  ventas a la vez no dejan el stock en negativo. Los lotes bloquean siempre en el mismo orden para
  evitar bloqueos cruzados.
- **Dinero**: los totales se calculan en centavos enteros para evitar errores de decimales.
- **Numeración**: los números de compra y venta salen de secuencias de Postgres
  (`compras_consecutivo_seq`, `ventas_consecutivo_seq`); pueden quedar saltos si una operación falla.
- **`DB_SYNCHRONIZE=true`** crea las tablas automáticamente: cómodo en desarrollo, pero para
  producción hay que pasar a migraciones de TypeORM (y crear las dos secuencias ahí).

## Siguientes pasos

1. Anulación de compras y ventas (revierte el stock) y devoluciones.
2. Eventos entre módulos/servicios (`stock.bajo`, `venta.confirmada`) con un broker (RabbitMQ, NATS o Redis).
3. **Servidor MCP** de repuestos (`consultar_stock`, `buscar_repuesto_por_vehiculo`, `reservar_repuesto`...)
   como otro adaptador de entrada sobre los mismos services.
4. Servicios de contabilidad, taller y concesionario, y sus agentes.
5. Autenticación y roles.
