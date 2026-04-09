import { Inject, Injectable } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';

import { RedisService } from './redis.service';

type ThrottlerStorageRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly fallbackStorage = new ThrottlerStorageService();

  constructor(
    @Inject(RedisService)
    private readonly redisService: RedisService,
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (!this.redisService.isAvailable()) {
      return this.fallbackStorage.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }

    const client = this.redisService.getClient();

    if (!client) {
      return this.fallbackStorage.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }

    const hitsKey = `throttle:${throttlerName}:hits:${key}`;
    const blockKey = `throttle:${throttlerName}:block:${key}`;

    const totalHits = await client.incr(hitsKey);

    let timeToExpire = await client.pTTL(hitsKey);
    if (timeToExpire < 0) {
      await client.pExpire(hitsKey, ttl);
      timeToExpire = ttl;
    }

    let timeToBlockExpire = await client.pTTL(blockKey);
    let isBlocked = timeToBlockExpire > 0;

    if (!isBlocked && totalHits > limit) {
      if (blockDuration > 0) {
        await client.set(blockKey, '1', {
          PX: blockDuration,
        });
        timeToBlockExpire = blockDuration;
      } else {
        timeToBlockExpire = timeToExpire;
      }

      isBlocked = true;
    }

    return {
      totalHits,
      timeToExpire: Math.max(0, timeToExpire),
      isBlocked,
      timeToBlockExpire: Math.max(0, timeToBlockExpire),
    };
  }
}
