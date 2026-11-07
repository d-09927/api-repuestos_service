import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc, ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/domain-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Páginas estáticas (public/): el monitor en /monitor.html, mismo origen que la API (sin CORS).
  app.useStaticAssets(join(process.cwd(), 'public'));

  // El MCP queda fuera del prefijo: los agentes se conectan a /mcp.
  app.setGlobalPrefix('api', { exclude: ['mcp'] });
  // Validación con zod: cada DTO es un esquema; responde 400 con el detalle de lo que falla.
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new DomainExceptionFilter());
  app.enableShutdownHooks();

  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Servicio de repuestos')
      .setDescription('Repuestos, stock, proveedores, clientes, compras y ventas de la tienda de repuestos')
      .setVersion('0.1.0')
      .build(),
  );
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(documento));

  const puerto = Number(process.env.PORT ?? 3100);
  await app.listen(puerto);
  console.log(`API lista en http://localhost:${puerto}/api  |  Swagger: http://localhost:${puerto}/docs`);
}

bootstrap();
