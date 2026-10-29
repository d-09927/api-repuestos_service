# MCP de repuestos

Servidor [MCP](https://modelcontextprotocol.io) que expone la API de repuestos como **herramientas** para
agentes (el orquestador, Claude Desktop, Claude Code, Cursor, etc.). No toca la base de datos: todo pasa por
la API HTTP, así se respetan sus reglas de negocio.

```
agente ──MCP──► mcp-repuestos ──HTTP──► API de repuestos ──► Postgres
```

## Cómo correrlo

```bash
cd mcp-repuestos
cp .env.example .env        # y ajusta REPUESTOS_API_URL si hace falta
npm install
npm run inspector           # abre MCP Inspector para probar cada herramienta a mano
```

La API debe estar levantada (`npm run start:dev` en la raíz del proyecto).

| Script | Qué hace |
|---|---|
| `npm run dev` | Arranca el servidor con tsx (stdio por defecto) |
| `npm run build` / `npm start` | Compila a `dist/` y arranca |
| `npm run inspector` | MCP Inspector sobre el servidor |
| `npm run smoke` | Prueba de punta a punta con un cliente MCP real (stdio y HTTP). Crea datos de prueba con SKU únicos |

## Variables de entorno

| Variable | Por defecto | Para qué |
|---|---|---|
| `REPUESTOS_API_URL` | `http://localhost:3000/api` | URL de la API (con `/api`) |
| `MCP_TRANSPORT` | `stdio` | `stdio` o `http` |
| `MCP_PORT` | `3100` | Puerto (solo `http`) |
| `MCP_TOKEN` | vacío | Si se define, en `http` el cliente debe enviar `Authorization: Bearer <token>` |
| `MCP_PERMITIR_ESCRITURA` | `false` | Habilita las herramientas que modifican datos |

**stdio**: el cliente lanza el servidor como proceso hijo (lo más simple; para un solo agente en la misma máquina).
**http**: servicio con URL propia, `POST http://localhost:3100/mcp` y `GET /health` (para varios agentes o contenedores).
En stdio no se puede escribir en stdout (es el canal del protocolo): los logs van a stderr.

## Herramientas

**Lectura** (siempre disponibles)

| Herramienta | Qué hace |
|---|---|
| `buscar_repuestos` | Catálogo por texto, marca o categoría |
| `buscar_repuestos_por_vehiculo` | Repuestos compatibles con marca, modelo y año |
| `obtener_repuesto` | Detalle de un repuesto |
| `consultar_stock` | Existencias de un repuesto por bodega |
| `disponibilidad_repuestos` | Busca y devuelve precio + unidades disponibles en una sola llamada |
| `stock_bajo` | Lo que hay que reponer |
| `consultar_movimientos` | Historial de entradas, salidas, reservas y ajustes |
| `buscar_proveedores` / `buscar_clientes` | Búsqueda por nombre o documento |
| `consultar_ventas` / `obtener_venta` | Ventas por cliente y fechas; detalle con líneas |
| `consultar_compras` / `obtener_compra` | Compras por proveedor y fechas; detalle con líneas |

**Escritura** (solo con `MCP_PERMITIR_ESCRITURA=true`)

| Herramienta | Qué hace |
|---|---|
| `reservar_repuesto` / `liberar_reserva` | Aparta o devuelve unidades |
| `registrar_venta` | Vende y descuenta stock (todo o nada) |
| `registrar_compra` | Compra a proveedor y suma stock |

Todas las de escritura exigen `confirmado`: con `false` no ejecutan nada y devuelven un **resumen** (con precios,
totales y si alcanza el stock) para mostrárselo al usuario; solo con `true` llaman a la API. El prompt del
agente debe pedir un "sí" explícito antes de enviar `confirmado: true`.

Los errores de negocio de la API (404, 409 por stock insuficiente, 400 por datos inválidos) llegan al modelo como
resultado con `isError` y un mensaje legible, para que pueda corregirse o avisar al usuario.

## Usarlo desde Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "repuestos": {
      "command": "npx",
      "args": ["tsx", "C:/ruta/al/proyecto/mcp-repuestos/src/index.ts"],
      "env": { "REPUESTOS_API_URL": "http://localhost:3000/api" }
    }
  }
}
```

## Estructura

```
src/
  index.ts              arranque: elige stdio o http
  server.ts             crea el servidor y registra las herramientas
  config.ts             variables de entorno validadas con zod
  api-client.ts         único punto que hace fetch a la API
  resultado.ts          formato de respuestas y traducción de errores
  tools/                un archivo por dominio: repuestos, stock, personas, documentos, escritura
scripts/smoke.ts        prueba de punta a punta
```
