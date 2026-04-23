import { Body, Controller, Get, Inject, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAccessPayload } from '../../common/types/jwt-payload.type';
import { getRequestMeta } from '../../common/utils/request-meta';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

const publicThrottle = { default: { limit: 20, ttl: 60_000 } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @Throttle(publicThrottle)
  @ApiOperation({ summary: 'Cria uma conta nova' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  @Public()
  @Throttle(publicThrottle)
  @ApiOperation({ summary: 'Confirma o e-mail da conta' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @Public()
  @Throttle(publicThrottle)
  @ApiOperation({ summary: 'Reenvia o link de verificacao de e-mail' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Post('forgot-password')
  @Public()
  @Throttle(publicThrottle)
  @ApiOperation({ summary: 'Inicia fluxo de redefinicao de senha por e-mail' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Public()
  @Throttle(publicThrottle)
  @ApiOperation({ summary: 'Conclui a redefinicao de senha com token recebido por e-mail' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('login')
  @Public()
  @Throttle(publicThrottle)
  @ApiOperation({ summary: 'Autentica o usuario e devolve os tokens' })
  login(@Body() dto: LoginDto, @Req() request: FastifyRequest) {
    return this.authService.login(dto, getRequestMeta(request));
  }

  @Post('refresh')
  @Public()
  @Throttle(publicThrottle)
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
