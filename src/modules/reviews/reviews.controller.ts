import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAccessPayload } from '../../common/types/jwt-payload.type';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Avaliacoes')
@Controller('avaliacoes')
export class ReviewsController {
  constructor(
    @Inject(ReviewsService) private readonly reviewsService: ReviewsService,
  ) {}

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cria uma avaliacao para anunciante ou comprador' })
  create(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(user.sub, dto);
  }

  @Get(':usuarioId')
  @Public()
  @ApiOperation({ summary: 'Lista avaliacoes publicas de um usuario' })
  listByUser(
    @Param('usuarioId') usuarioId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.reviewsService.listByUser(
      usuarioId,
      pagination.page ?? 1,
      pagination.pageSize ?? 20,
    );
  }
}
