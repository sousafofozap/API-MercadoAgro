import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const configService = app.get(ConfigService);
  const appName = configService.getOrThrow<string>('APP_NAME');

  const swaggerConfig = new DocumentBuilder()
    .setTitle(appName)
    .setDescription(
      'API REST mobile-first para Flutter (iOS/Android) com JWT, RBAC e Prisma.',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token JWT',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: `${appName} Docs`,
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
