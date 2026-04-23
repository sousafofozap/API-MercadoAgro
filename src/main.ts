import 'reflect-metadata';

import { config as loadEnv } from 'dotenv';
import helmet from '@fastify/helmet';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });

function resolveTrustProxy() {
  return (process.env.TRUST_PROXY ?? 'false').trim().toLowerCase() === 'true';
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      trustProxy: resolveTrustProxy(),
      bodyLimit: 1_048_576, // 1 MB
    }),
  );

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');
  const prefix = config.getOrThrow<string>('API_PREFIX');
  const nodeEnv = config.getOrThrow<string>('NODE_ENV');
  const corsOrigins = config.get<string[]>('CORS_ORIGINS') ?? [];

  await app.register(helmet as never, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: {
      maxAge: 15_552_000,
      includeSubDomains: true,
      preload: true,
    },
  });

  const allowAllOrigins = nodeEnv !== 'production';
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : allowAllOrigins,
    credentials: true,
  });

  app.setGlobalPrefix(prefix);
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  setupSwagger(app);

  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((error) => {
  console.error('Erro ao iniciar a API:', error);
  process.exit(1);
});
