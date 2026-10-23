import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VentasService } from '../../application/ventas.service';
import { CreateVentaDto } from './dto/create-venta.dto';
import { ListVentasQueryDto } from './dto/list-ventas.query.dto';
import { toVentaResponse } from './venta.response';

/** Solo HTTP: recibe, delega en el service y responde. No hay editar ni borrar. */
@ApiTags('ventas')
@Controller('ventas')
export class VentasController {
  constructor(private readonly service: VentasService) {}

  @Post()
  async create(@Body() dto: CreateVentaDto) {
    return toVentaResponse(await this.service.registrar(dto));
  }

  @Get()
  async findAll(@Query() query: ListVentasQueryDto) {
    const pagina = await this.service.listar(query);
    return { ...pagina, items: pagina.items.map(toVentaResponse) };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return toVentaResponse(await this.service.obtener(id));
  }
}
