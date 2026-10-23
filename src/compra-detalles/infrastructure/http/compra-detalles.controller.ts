import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CompraDetallesService } from '../../application/compra-detalles.service';
import { toCompraDetalleResponse } from './compra-detalle.response';

/** Solo lectura: las líneas se crean junto con la compra (POST /compras). */
@ApiTags('compra-detalles')
@Controller('compras/:compraId/detalles')
export class CompraDetallesController {
  constructor(private readonly service: CompraDetallesService) {}

  @Get()
  async findAll(@Param('compraId', ParseUUIDPipe) compraId: string) {
    return (await this.service.listarPorCompras([compraId])).map(toCompraDetalleResponse);
  }
}
