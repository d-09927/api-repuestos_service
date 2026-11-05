/*
 * Carga la venta de prueba que pidió AutoMax: una compra de suspensión para el VIN de REL-1006,
 * con fecha 2026-05-02, y ninguna de frenos para ese VIN. La venta pasa por la API REST (mueve el
 * stock como cualquier otra) y luego se le pone la fecha del contrato en la base, porque la API
 * siempre usa la fecha actual. Se puede correr varias veces: si ya existe, no crea otra.
 *
 *   npm run start:dev            (en otra terminal)
 *   npm run sembrar:garantia
 */
const { Client } = require('pg');

const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const VIN = '3MZBP2SM1SM600006';
const CODIGO = 'AMO-TRA-GAS';
const FECHA = '2026-05-02T10:15:00-05:00';
const OBSERVACION = 'Venta de prueba de garantía para AutoMax (REL-1006)';

async function main() {
  const db = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'repuestos',
    password: process.env.DB_PASSWORD ?? 'repuestos_dev',
    database: process.env.DB_NAME ?? 'repuestos',
  });
  await db.connect();
  try {
    const previa = await db.query('SELECT numero FROM ventas WHERE vin = $1 AND observaciones = $2', [VIN, OBSERVACION]);
    if (previa.rowCount) {
      console.log(`Ya existía la venta ${previa.rows[0].numero}`);
      return;
    }

    const listado = await fetch(`${BASE}/api/repuestos?codigoUniversal=${CODIGO}`).then((r) => r.json());
    const repuesto = listado.items?.[0];
    if (!repuesto) throw new Error(`No hay un repuesto con el código ${CODIGO}: corra antes npm run sembrar:codigos`);

    const r = await fetch(`${BASE}/api/ventas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vin: VIN, observaciones: OBSERVACION, lineas: [{ repuestoId: repuesto.id, cantidad: 1 }] }),
    });
    const venta = await r.json();
    if (r.status !== 201) throw new Error(`No se pudo crear la venta: ${r.status} ${JSON.stringify(venta)}`);

    await db.query('UPDATE ventas SET fecha = $1 WHERE id = $2', [FECHA, venta.id]);
    console.log(`Venta ${venta.numero}: 1 ${CODIGO} para ${VIN}, con fecha ${FECHA}`);
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
