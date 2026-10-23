/**
 * Cálculos de dinero en centavos enteros para evitar errores de coma flotante
 * (0.1 + 0.2 !== 0.3). Los valores se guardan en pesos con 2 decimales.
 */
export function aCentavos(valor: number): number {
  return Math.round(valor * 100);
}

export function deCentavos(centavos: number): number {
  return centavos / 100;
}

/** cantidad × precio unitario, redondeado a 2 decimales. */
export function subtotal(cantidad: number, precioUnitario: number): number {
  return deCentavos(Math.round(cantidad * aCentavos(precioUnitario)));
}

export function sumar(valores: number[]): number {
  return deCentavos(valores.reduce((total, v) => total + aCentavos(v), 0));
}
