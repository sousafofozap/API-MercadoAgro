import { Body, Controller, Get, Inject, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAccessPayload } from '../../common/types/jwt-payload.type';
import { getRequestMeta } from '../../common/utils/request-meta';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @Throttle({
    default: {
      limit: 20,
      ttl: 60_000,
    },
  })
  @ApiOperation({ summary: 'Cria uma conta nova' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  @Public()
  @Throttle({
    default: {
      limit: 20,
      ttl: 60_000,
    },
  })
  @ApiOperation({ summary: 'Confirma o e-mail da conta' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @Public()
  @Throttle({
    default: {
      limit: 20,
      ttl: 60_000,
    },
  })
  @ApiOperation({ summary: 'Reenvia o link de verificacao de e-mail' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Post('login')
  @Public()
  @Throttle({
    default: {
      limit: 20,
      ttl: 60_000,
    },
  })
  @ApiOperation({ summary: 'Autentica o usuario e devolve os tokens' })
  login(@Body() dto: LoginDto, @Req() request: FastifyRequest) {
    return this.authService.login(dto, getRequestMeta(request));
  }

  @Post('refresh')
  @Public()
  @Throttle({
    default: {
      limit: 20,
      ttl: 60_000,
    },
  })
  @ApiOperation({ summary: 'Rotaciona o refresh token' })
  refresh(@Body() dto: RefreshTokenDto, @Req() request: FastifyRequest) {
    return this.authService.refresh(dto, getRequestMeta(request));
  }

  @Post('logout')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoga um refresh token ativo' })
  logout(@CurrentUser() user: JwtAccessPayload, @Body() dto: LogoutDto) {
    return this.authService.logout(user.sub, dto);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Retorna o payload autenticado atual' })
  me(@CurrentUser() user: JwtAccessPayload) {
    return user;
  }
}
