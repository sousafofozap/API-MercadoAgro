import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RedisService)
    private readonly redisService: RedisService,
    @Inject(MailService)
    private readonly mailService: MailService,
  ) {}

  async check() {
    const redisPromise = this.redisService.isEnabled()
      ? this.redisService.ping()
      : Promise.resolve('DISABLED');

    const [database, redis, mail] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      redisPromise,
      this.mailService.ping(),
    ]);

    const dependencies = {
      database: database.status === 'fulfilled' ? 'up' : 'down',
      redis: !this.redisService.isEnabled()
        ? 'disabled'
        : redis.status === 'fulfilled'
          ? 'up'
          : 'down',
      mail: mail.status === 'fulfilled' ? 'up' : 'down',
    } as const;

    const status = Object.values(dependencies).every(
      (value) => value === 'up' || value === 'disabled',
    )
      ? 'ok'
      : 'degraded';

    return {
      status,
      app: this.configService.getOrThrow<string>('APP_NAME'),
      environment: this.configService.getOrThrow<string>('NODE_ENV'),
      timestamp: new Date().toISOString(),
      uptimeInSeconds: Math.floor(process.uptime()),
      dependencies,
    };
  }
}
