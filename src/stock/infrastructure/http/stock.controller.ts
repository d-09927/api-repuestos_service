import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StockService } from '../../application/stock.service';
import {
  AjusteStockDto,
  EntradaStockDto,
  MovimientoStockDto,
  SalidaStockDto,
} from './dto/movimiento-stock.dto';
import { toStockResponse } from './stock.response';

/** Solo HTTP: recibe, delega en el service y responde. */
@ApiTags('stock')
@Controller('stock')
export class StockController {
  constructor(private readonly service: StockService) {}

  @Post('entradas')
  async registrarEntrada(@Body() dto: EntradaStockDto) {
    return toStockResponse(await this.service.registrarEntrada(dto));
  }

  @Post('salidas')
  @HttpCode(HttpStatus.OK)
  async registrarSalida(@Body() dto: SalidaStockDto) {
    return toStockResponse(await this.service.registrarSalida(dto));
  }

  @Post('reservas')
  @HttpCode(HttpStatus.OK)
  async reservar(@Body() dto: MovimientoStockDto) {
    return toStockResponse(await this.service.reservar(dto));
  }

  @Post('reservas/liberar')
  @HttpCode(HttpStatus.OK)
  async liberarReserva(@Body() dto: MovimientoStockDto) {
    return toStockResponse(await this.service.liberarReserva(dto));
  }

  @Post('ajustes')
  @HttpCode(HttpStatus.OK)
  async ajustar(@Body() dto: AjusteStockDto) {
    return toStockResponse(await this.service.ajustar(dto));
  }

  /** Stock de un repuesto en todas las bodegas. */
  @Get('repuestos/:repuestoId')
  async consultarStock(@Param('repuestoId', ParseUUIDPipe) repuestoId: string) {
    const consulta = await this.service.consultarPorRepuesto(repuestoId);
    return { ...consulta, bodegas: consulta.bodegas.map(toStockResponse) };
  }

  /** Lo que hay en las bodegas, una vez por código universal (lo que el taller puede pedir). */
  @Get('catalogo')
  catalogo(@Query('categoria') categoria?: string) {
    return this.service.catalogo(categoria);
  }

  /** Repuestos que hay que reponer. */
  @Get('stock-bajo')
  async stockBajo() {
    return (await this.service.stockBajo()).map(toStockResponse);
  }
}
