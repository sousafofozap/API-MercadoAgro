import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthService)
    private readonly healthService: HealthService,
  ) {}

  @Get()
  @Public()
  @Throttle({
    default: {
      limit: 20,
      ttl: 60_000,
    },
  })
  @ApiOperation({ summary: 'Health check basico da API' })
  getHealth() {
    return this.healthService.check();
  }
}
