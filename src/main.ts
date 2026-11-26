import path from 'node:path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
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

  const frontendDist = path.resolve(process.cwd(), '../frontend/dist');
  app.useStaticAssets(frontendDist, { index: false, redirect: false });
  // React Router dùng cùng index.html khi tải trực tiếp mỗi trang.
  app.getHttpAdapter().getInstance().get(['/', '/dashboard', '/edge-nodes', '/edge-nodes/setup'], (_request, response) => {
    response.sendFile('index.html', { root: frontendDist, maxAge: 0 });
  });

  const port = Number(config.getOrThrow<string>('PORT'));
  await app.listen(port);
  Logger.log(`API ready at http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
