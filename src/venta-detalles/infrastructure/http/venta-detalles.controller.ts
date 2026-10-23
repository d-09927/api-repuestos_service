import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VentaDetallesService } from '../../application/venta-detalles.service';
import { toVentaDetalleResponse } from './venta-detalle.response';

/** Solo lectura: las líneas se crean junto con la venta (POST /ventas). */
@ApiTags('venta-detalles')
@Controller('ventas/:ventaId/detalles')
export class VentaDetallesController {
  constructor(private readonly service: VentaDetallesService) {}

  @Get()
  async findAll(@Param('ventaId', ParseUUIDPipe) ventaId: string) {
    return (await this.service.listarPorVentas([ventaId])).map(toVentaDetalleResponse);
  }
}
