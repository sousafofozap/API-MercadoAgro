import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAccessPayload } from '../../common/types/jwt-payload.type';
import { AddPhotoDto } from './dto/add-photo.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListListingsQueryDto } from './dto/list-listings.query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';

const publicThrottle = { default: { limit: 20, ttl: 60_000 } };

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(
    @Inject(ListingsService)
    private readonly listingsService: ListingsService,
  ) {}

  @Get()
  @Public()
  @Throttle(publicThrottle)
  @ApiOperation({ summary: 'Lista anuncios publicados com filtros e paginacao' })
  listPublic(@Query() query: ListListingsQueryDto) {
    return this.listingsService.listPublic(query);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Lista os proprios anuncios do anunciante autenticado' })
  findMine(
    @CurrentUser() user: JwtAccessPayload,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.listingsService.findMine(
      user.sub,
      pagination.page ?? 1,
      pagination.pageSize ?? 20,
    );
  }

  @Get(':id')
  @Public()
  @Throttle(publicThrottle)
  @ApiOperation({ summary: 'Retorna detalhes completos de um anuncio' })
  findById(@Param('id') id: string) {
    return this.listingsService.findById(id);
  }

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cria um novo anuncio' })
  create(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateListingDto) {
    return this.listingsService.create(user.sub, dto);
  }

  @Put(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Edita um anuncio proprio' })
  update(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listingsService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove um anuncio proprio (soft delete)' })
  remove(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    return this.listingsService.remove(id, user.sub);
  }

  @Post(':id/photos')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Adiciona uma foto ao anuncio (envie a URL apos upload para CDN)' })
  addPhoto(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: AddPhotoDto,
  ) {
    return this.listingsService.addPhoto(id, user.sub, dto);
  }

  @Delete(':id/photos/:photoId')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove uma foto do anuncio' })
  removePhoto(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
  ) {
    return this.listingsService.removePhoto(id, photoId, user.sub);
  }
}
