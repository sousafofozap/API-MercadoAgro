import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { getClientIp } from './common/utils/client-ip';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { ListingsModule } from './modules/listings/listings.module';
import { MailModule } from './modules/mail/mail.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { RedisThrottlerStorage } from './modules/redis/redis-throttler.storage';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [ConfigService, RedisThrottlerStorage],
      useFactory: (
        configService: ConfigService,
        redisThrottlerStorage: RedisThrottlerStorage,
      ) => ({
        storage: redisThrottlerStorage,
        getTracker: (req) => getClientIp(req) ?? 'unknown',
        throttlers: [
          {
            ttl: configService.getOrThrow<number>('THROTTLE_TTL_MS'),
            limit: configService.getOrThrow<number>('THROTTLE_LIMIT'),
          },
        ],
      }),
    }),
    PrismaModule,
    RedisModule,
    MailModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ListingsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
