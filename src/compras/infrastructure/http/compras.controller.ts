import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ComprasService } from '../../application/compras.service';
import { toCompraResponse } from './compra.response';
import { CreateCompraDto } from './dto/create-compra.dto';
import { ListComprasQueryDto } from './dto/list-compras.query.dto';

/** Solo HTTP: recibe, delega en el service y responde. No hay editar ni borrar. */
@ApiTags('compras')
@Controller('compras')
export class ComprasController {
  constructor(private readonly service: ComprasService) {}

  @Post()
  async create(@Body() dto: CreateCompraDto) {
    return toCompraResponse(await this.service.registrar(dto));
  }

  @Get()
  async findAll(@Query() query: ListComprasQueryDto) {
    const pagina = await this.service.listar(query);
    return { ...pagina, items: pagina.items.map(toCompraResponse) };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return toCompraResponse(await this.service.obtener(id));
  }
}
