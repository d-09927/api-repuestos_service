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
import { ProveedoresService } from '../../application/proveedores.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { ListProveedoresQueryDto } from './dto/list-proveedores.query.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { toProveedorResponse } from './proveedor.response';

/** Solo HTTP: recibe, delega en el service y responde. */
@ApiTags('proveedores')
@Controller('proveedores')
export class ProveedoresController {
  constructor(private readonly service: ProveedoresService) {}

  @Post()
  async create(@Body() dto: CreateProveedorDto) {
    return toProveedorResponse(await this.service.crear(dto));
  }

  @Get()
  async findAll(@Query() query: ListProveedoresQueryDto) {
    const pagina = await this.service.listar(query);
    return { ...pagina, items: pagina.items.map(toProveedorResponse) };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return toProveedorResponse(await this.service.obtener(id));
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProveedorDto) {
    return toProveedorResponse(await this.service.actualizar(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.desactivar(id);
  }
}
