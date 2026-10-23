import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MovimientosService } from '../../application/movimientos.service';
import { ListMovimientosQueryDto } from './dto/list-movimientos.query.dto';
import { toMovimientoResponse } from './movimiento.response';

/** Solo lectura: los movimientos los crea el módulo de stock al mover existencias. */
@ApiTags('movimientos')
@Controller('stock/movimientos')
export class MovimientosController {
  constructor(private readonly service: MovimientosService) {}

  @Get()
  async findAll(@Query() query: ListMovimientosQueryDto) {
    const pagina = await this.service.listar(query);
    return { ...pagina, items: pagina.items.map(toMovimientoResponse) };
  }
}
