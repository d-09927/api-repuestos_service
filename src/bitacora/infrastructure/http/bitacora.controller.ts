import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BitacoraService } from '../../application/bitacora.service';
import { ListBitacoraQueryDto } from './dto/list-bitacora.query.dto';
import { toLlamadaMcpResponse } from './llamada-mcp.response';

/** Solo lectura: los registros los crea el MCP en cada llamada a una herramienta. */
@ApiTags('bitacora')
@Controller('bitacora')
export class BitacoraController {
  constructor(private readonly service: BitacoraService) {}

  @Get()
  async findAll(@Query() query: ListBitacoraQueryDto) {
    const pagina = await this.service.listar(query);
    return { ...pagina, items: pagina.items.map(toLlamadaMcpResponse) };
  }
}
