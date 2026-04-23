import { Body, Controller, Delete, Get, HttpCode, Inject, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAccessPayload } from '../../common/types/jwt-payload.type';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Retorna os dados da conta autenticada' })
  me(@CurrentUser() user: JwtAccessPayload) {
    return this.usersService.findMe(user.sub);
  }

  @Put('me')
  @ApiOperation({ summary: 'Atualiza nome, telefone ou avatar da conta' })
  updateMe(@CurrentUser() user: JwtAccessPayload, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user.sub, dto);
  }

  @Delete('me')
  @HttpCode(200)
  @ApiOperation({ summary: 'Encerra a conta (soft delete — LGPD Art. 18)' })
  deleteMe(@CurrentUser() user: JwtAccessPayload) {
    return this.usersService.deleteMe(user.sub);
  }
}
