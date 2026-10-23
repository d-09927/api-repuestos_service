import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RepuestosService } from '../../application/repuestos.service';
import { CreateRepuestoDto } from './dto/create-repuesto.dto';
import { ListRepuestosQueryDto } from './dto/list-repuestos.query.dto';
import { UpdateRepuestoDto } from './dto/update-repuesto.dto';
import { toRepuestoResponse } from './repuesto.response';

/** Solo HTTP: recibe, delega en el service y responde. */
@ApiTags('repuestos')
@Controller('repuestos')
export class RepuestosController {
  constructor(private readonly service: RepuestosService) {}

  @Post()
  async create(@Body() dto: CreateRepuestoDto) {
    return toRepuestoResponse(await this.service.crear(dto));
  }

  @Get()
  async findAll(@Query() query: ListRepuestosQueryDto) {
    const pagina = await this.service.listar(query);
    return { ...pagina, items: pagina.items.map(toRepuestoResponse) };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return toRepuestoResponse(await this.service.obtenerDetalle(id));
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRepuestoDto) {
    return toRepuestoResponse(await this.service.actualizar(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.desactivar(id);
  }
}
