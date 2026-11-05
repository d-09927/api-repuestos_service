import { ValidationDomainError } from './domain-error';

// 17 caracteres, letras y números, sin I, O ni Q (así se define un VIN).
const VIN_VALIDO = /^[A-HJ-NPR-Z0-9]{17}$/;

/** El VIN en mayúsculas y sin espacios. Lanza ValidationDomainError si está mal formado. */
export function normalizarVin(vin: string): string {
  const limpio = String(vin ?? '').trim().toUpperCase();
  if (!VIN_VALIDO.test(limpio)) {
    throw new ValidationDomainError('El VIN debe tener 17 letras y números, sin I, O ni Q');
  }
  return limpio;
}
