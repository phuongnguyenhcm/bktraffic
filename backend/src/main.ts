import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const origins = config
    .getOrThrow<string>('FRONTEND_URL')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({ origin: origins });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();

  const port = Number(config.getOrThrow<string>('PORT'));
  await app.listen(port);
  Logger.log(`API ready at http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
