import { ConflictError } from '../../../common/domain-error';

/** No alcanzan las unidades disponibles o reservadas -> 409 */
export class StockInsuficienteError extends ConflictError {}
