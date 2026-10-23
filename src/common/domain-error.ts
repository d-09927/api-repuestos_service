/**
 * Errores de negocio. No dependen de HTTP: el filtro de la capa web
 * (domain-exception.filter.ts) decide qué código de estado les corresponde.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Datos inválidos según las reglas del negocio -> 400 */
export class ValidationDomainError extends DomainError {}

/** El recurso no existe -> 404 */
export class NotFoundError extends DomainError {}

/** La operación choca con el estado actual (duplicado, stock insuficiente...) -> 409 */
export class ConflictError extends DomainError {}
