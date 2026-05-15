import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAccessPayload } from '../../common/types/jwt-payload.type';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

type UserResponse = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  termsAcceptedAt: Date | null;
  privacyAcceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function serializeUsuarioPt(user: UserResponse) {
  return {
    id: user.id,
    nome: user.fullName,
    email: user.email,
    telefone: user.phone,
    perfil: user.role === UserRole.ADMIN ? 'admin' : 'anunciante',
    foto_url: user.avatarUrl,
    nota_media: null,
    total_avaliacoes: 0,
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
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Retorna os dados da conta no contrato PT-BR' })
  async me(@CurrentUser() user: JwtAccessPayload) {
    const data = await this.usersService.findMe(user.sub);
    return serializeUsuarioPt(data as UserResponse);
  }

  @Put('me')
  @ApiOperation({ summary: 'Atualiza perfil usando payload PT-BR' })
  async updateMe(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: UpdateUserDto,
  ) {
    const data = await this.usersService.updateMe(user.sub, dto);
    return serializeUsuarioPt(data as UserResponse);
  }

  @Delete('me')
  @HttpCode(204)
  @ApiOperation({ summary: 'Solicita exclusao de conta e dados' })
  async deleteMe(@CurrentUser() user: JwtAccessPayload) {
    await this.usersService.deleteMe(user.sub);
  }

  @Get(':id/avaliacoes')
  @Public()
  @ApiOperation({
    summary: 'Lista avaliacoes publicas de um anunciante (fora do MVP)',
  })
  listReviews(@Param('id') id: string) {
    return {
      data: [],
      meta: {
        usuario_id: id,
        total: 0,
        page: 1,
        per_page: 20,
        pages: 0,
      },
    };
  }
}
