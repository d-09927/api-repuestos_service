import { ConflictError } from '../../../common/domain-error';

/** Dos operaciones crearon a la vez el mismo registro de stock; la segunda se puede reintentar. */
export class StockConcurrenteError extends ConflictError {}
