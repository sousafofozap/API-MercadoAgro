import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserProfile, UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAccessPayload } from '../../common/types/jwt-payload.type';
import { ReviewsService } from '../reviews/reviews.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

type UserResponse = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  profile: UserProfile;
  phone: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  termsAcceptedAt: Date | null;
  privacyAcceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ReviewStats = {
  nota_media: number | null;
  total_avaliacoes: number;
};

function serializeUsuarioPt(
  user: UserResponse,
  stats: ReviewStats = { nota_media: null, total_avaliacoes: 0 },
) {
  return {
    id: user.id,
    nome: user.fullName,
    email: user.email,
    telefone: user.phone,
    perfil:
      user.role === UserRole.ADMIN
        ? 'admin'
        : user.profile === UserProfile.COMPRADOR
          ? 'comprador'
          : 'anunciante',
    foto_url: user.avatarUrl,
    nota_media: stats.nota_media,
    total_avaliacoes: stats.total_avaliacoes,
    email_verificado_em: user.emailVerifiedAt,
    aceite_termos_em: user.termsAcceptedAt,
    aceite_privacidade_em: user.privacyAcceptedAt,
    criado_em: user.createdAt,
    atualizado_em: user.updatedAt,
  };
}

@ApiTags('Usuarios')
@ApiBearerAuth('access-token')
@Controller('usuarios')
export class UsuariosController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(ReviewsService) private readonly reviewsService: ReviewsService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Retorna os dados da conta no contrato PT-BR' })
  async me(@CurrentUser() user: JwtAccessPayload) {
    const [data, stats] = await Promise.all([
      this.usersService.findMe(user.sub),
      this.reviewsService.statsForUser(user.sub),
    ]);
    return serializeUsuarioPt(data as UserResponse, stats);
  }

  @Put('me')
  @ApiOperation({ summary: 'Atualiza perfil usando payload PT-BR' })
  async updateMe(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: UpdateUserDto,
  ) {
    const [data, stats] = await Promise.all([
      this.usersService.updateMe(user.sub, dto),
      this.reviewsService.statsForUser(user.sub),
    ]);
    return serializeUsuarioPt(data as UserResponse, stats);
  }

  @Delete('me')
  @HttpCode(204)
  @ApiOperation({ summary: 'Solicita exclusao de conta e dados' })
  async deleteMe(@CurrentUser() user: JwtAccessPayload) {
    await this.usersService.deleteMe(user.sub);
  }

  @Get(':id/avaliacoes')
  @Public()
  @ApiOperation({ summary: 'Lista avaliacoes publicas de um usuario' })
  listReviews(
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.reviewsService.listByUser(
      id,
      pagination.page ?? 1,
      pagination.pageSize ?? 20,
    );
  }
}
