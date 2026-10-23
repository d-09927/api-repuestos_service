import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc, ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/domain-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
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

  const puerto = Number(process.env.PORT ?? 3000);
  await app.listen(puerto);
  console.log(`API lista en http://localhost:${puerto}/api  |  Swagger: http://localhost:${puerto}/docs`);
}

bootstrap();
