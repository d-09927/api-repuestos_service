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
import { ClientesService } from '../../application/clientes.service';
import { toClienteResponse } from './cliente.response';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { ListClientesQueryDto } from './dto/list-clientes.query.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

/** Solo HTTP: recibe, delega en el service y responde. */
@ApiTags('clientes')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  @Post()
  async create(@Body() dto: CreateClienteDto) {
    return toClienteResponse(await this.service.crear(dto));
  }

  @Get()
  async findAll(@Query() query: ListClientesQueryDto) {
    const pagina = await this.service.listar(query);
    return { ...pagina, items: pagina.items.map(toClienteResponse) };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return toClienteResponse(await this.service.obtener(id));
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClienteDto) {
    return toClienteResponse(await this.service.actualizar(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.desactivar(id);
  }
}
