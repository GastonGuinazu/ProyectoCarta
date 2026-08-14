import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import {
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHODS,
} from './core/config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Railway termina TLS delante de Nest: hace falta para req.ip (throttle) y HSTS.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Front en Vercel, API en Railway: orígenes distintos. CORP same-origin
  // bloquearía el fetch del panel y de la carta. CSP es del SPA, no de JSON.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService);
  const origins = config.getOrThrow<readonly string[]>('PUBLIC_WEB_ORIGINS');
  app.enableCors({
    origin: [...origins],
    methods: [...CORS_ALLOWED_METHODS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }
  await app.listen(port, '0.0.0.0');
}
bootstrap();