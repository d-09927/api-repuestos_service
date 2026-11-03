import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PedidosService } from '../../application/pedidos.service';
import { EstadoPedido } from '../../domain/enums/estado-pedido.enum';
import { toPedidoResponse } from './pedido.response';

/**
 * Solo lectura. Apartar, entregar, cancelar y pagar no tienen endpoint REST a propósito: los
 * otros sectores lo piden por mensaje a nuestro agente (hablar_con_repuestos), que usa el MCP.
 */
@ApiTags('pedidos')
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly service: PedidosService) {}

  @Get()
  async findAll(@Query('estado') estado?: EstadoPedido) {
    return (await this.service.listar(estado)).map(toPedidoResponse);
  }

  @Get(':codigoOrden')
  async findOne(@Param('codigoOrden') codigoOrden: string) {
    return toPedidoResponse(await this.service.consultar(codigoOrden));
  }
}
