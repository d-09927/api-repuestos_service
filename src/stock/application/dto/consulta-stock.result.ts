import { StockItem } from '../../domain/entities/stock-item.entity';

export interface ConsultaStock {
  repuestoId: string;
  totalFisico: number;
  totalDisponible: number;
  bodegas: StockItem[];
}
