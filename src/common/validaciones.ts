import { ValidationDomainError } from './domain-error';

export function textoObligatorio(valor: string | undefined | null, campo: string, max: number): string {
  const limpio = (valor ?? '').trim();
  if (!limpio) throw new ValidationDomainError(`${campo} es obligatorio`);
  if (limpio.length > max) {
    throw new ValidationDomainError(`${campo} no puede superar ${max} caracteres`);
  }
  return limpio;
}

/** Texto que puede venir vacío: devuelve null si no hay nada. */
export function textoOpcional(valor: string | undefined | null, campo: string, max: number): string | null {
  const limpio = (valor ?? '').trim();
  if (!limpio) return null;
  if (limpio.length > max) {
    throw new ValidationDomainError(`${campo} no puede superar ${max} caracteres`);
  }
  return limpio;
}

export function emailOpcional(valor: string | undefined | null): string | null {
  const limpio = textoOpcional(valor, 'El email', 150);
  if (limpio === null) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) {
    throw new ValidationDomainError('El email no tiene un formato válido');
  }
  return limpio.toLowerCase();
}
