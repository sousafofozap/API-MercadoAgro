import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClientType, createClient } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly enabled: boolean;
  private readonly client?: RedisClientType;
  private available = false;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.configService.getOrThrow<boolean>('REDIS_ENABLED');

    if (!this.enabled) {
      this.logger.log(
        'Redis desativado por configuracao. O rate limiting usara storage em memoria.',
      );
      return;
    }

    this.client = createClient({
      url: this.configService.getOrThrow<string>('REDIS_URL'),
    });

    this.client.on('error', (error) => {
      this.available = false;
      this.logger.error(`Redis error: ${error.message}`);
    });
  }

  async onModuleInit() {
    if (!this.enabled || !this.client) {
      return;
    }

    if (!this.client.isOpen) {
      try {
        await this.client.connect();
        this.available = true;
        this.logger.log('Conexao com Redis estabelecida.');
      } catch (error) {
        this.available = false;
        const message =
          error instanceof Error ? error.message : 'falha desconhecida ao conectar';
        this.logger.warn(
          `Nao foi possivel conectar ao Redis. Fallback em memoria sera usado. Motivo: ${message}`,
        );
      }
    }
  }

  async onModuleDestroy() {
    if (this.client?.isOpen) {
      await this.client.close();
    }
  }

  getClient() {
    return this.client;
  }

  async ping() {
    if (!this.client || !this.available) {
      throw new Error('Redis indisponivel');
    }

    return this.client.ping();
  }

  isReady() {
    return !!this.client?.isReady && this.available;
  }

  isEnabled() {
    return this.enabled;
  }

  isAvailable() {
    return this.enabled && this.isReady();
  }
}
