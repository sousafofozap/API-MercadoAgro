import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAccessPayload } from '../../common/types/jwt-payload.type';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListListingsQueryDto } from './dto/list-listings.query.dto';
import { ListingsService } from './listings.service';

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(
    @Inject(ListingsService)
    private readonly listingsService: ListingsService,
  ) {}

  @Get()
  @Public()
  @Throttle({
    default: {
      limit: 20,
      ttl: 60_000,
    },
  })
  @ApiOperation({ summary: 'Lista anuncios publicados' })
  listPublic(@Query() query: ListListingsQueryDto) {
    return this.listingsService.listPublic(query);
  }

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cria um anuncio' })
  create(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: CreateListingDto,
  ) {
    return this.listingsService.create(user.sub, dto);
  }
}
