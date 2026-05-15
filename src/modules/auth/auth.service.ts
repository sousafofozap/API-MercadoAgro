import { randomUUID } from 'crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserProfile, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import type { StringValue } from 'ms';

import {
  JwtAccessPayload,
  JwtRefreshPayload,
} from '../../common/types/jwt-payload.type';
import { parseDurationToMs } from '../../common/utils/duration';
import { RequestMeta } from '../../common/utils/request-meta';
import { hashOpaqueToken } from '../../common/utils/token-hash';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

type SafeUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  profile: UserProfile;
  phone: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
};

const PUBLIC_USER_ROLE = 'USER' as UserRole;

const passwordOptions: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(MailService)
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const fullName = this.pickRequired(dto.fullName, dto.nome, 'nome');
    const password = this.pickRequired(dto.password, dto.senha, 'senha');
    const phone = (dto.phone ?? dto.telefone)?.trim();
    const cpfCnpj = this.normalizeCpfCnpj(dto.cpfCnpj ?? dto.cpf_cnpj);
    const profile = this.mapProfile(dto.perfil);

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException(
        'Ja existe uma conta cadastrada com este e-mail.',
      );
    }

    const passwordHash = await argon2.hash(password, passwordOptions);
    const now = new Date();
    const termsVersion = this.configService.getOrThrow<string>('TERMS_VERSION');

    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email,
          fullName: fullName.trim(),
          role: PUBLIC_USER_ROLE,
          profile,
          ...(phone ? { phone } : {}),
          ...(cpfCnpj ? { cpfCnpj } : {}),
          passwordHash,
          termsAcceptedAt: now,
          privacyAcceptedAt: now,
          termsVersion,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ja existe uma conta cadastrada com este e-mail.',
        );
      }
      throw error;
    }

    const { verificationUrl } = await this.issueEmailVerificationToken(
      user.id,
      user.email,
      user.fullName,
    );

    await this.logAudit({
      event: 'auth.registered',
      userId: user.id,
      targetType: 'user',
      targetId: user.id,
      metadata: { email: user.email, role: user.role, profile: user.profile },
    });

    return {
      id: user.id,
      message:
        'Cadastro realizado. Confirme o e-mail antes de acessar a plataforma.',
      nome: user.fullName,
      email: user.email,
      perfil: this.serializeProfile(user.profile),
      role: user.role,
      criado_em: user.createdAt,
      ...(this.configService.getOrThrow<string>('NODE_ENV') !== 'production'
        ? { verificationUrl }
        : {}),
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const tokenHash = hashOpaqueToken(dto.token);
    const verificationRecord =
      await this.prisma.emailVerificationToken.findFirst({
        where: {
          tokenHash,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true, userId: true },
      });

    if (!verificationRecord) {
      throw new BadRequestException(
        'Token de verificacao invalido ou expirado.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verificationRecord.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: verificationRecord.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    await this.logAudit({
      event: 'auth.email_verified',
      userId: verificationRecord.userId,
      targetType: 'user',
      targetId: verificationRecord.userId,
    });

    return { message: 'E-mail verificado com sucesso.' };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, fullName: true, emailVerifiedAt: true },
    });

    if (!user || user.emailVerifiedAt) {
      return {
        message:
          'Se existir uma conta pendente para este e-mail, um novo link de verificacao sera enviado.',
      };
    }

    const { verificationUrl } = await this.issueEmailVerificationToken(
      user.id,
      user.email,
      user.fullName,
    );

    await this.logAudit({
      event: 'auth.verification_resent',
      userId: user.id,
      targetType: 'user',
      targetId: user.id,
    });

    return {
      message:
        'Se existir uma conta pendente para este e-mail, um novo link de verificacao sera enviado.',
      ...(this.configService.getOrThrow<string>('NODE_ENV') !== 'production'
        ? { verificationUrl }
        : {}),
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email, deletedAt: null },
      select: { id: true, email: true, fullName: true, emailVerifiedAt: true },
    });

    const genericResponse = {
      message:
        'Se existir uma conta ativa com este e-mail, voce recebera um link de redefinicao de senha.',
    };

    if (!user || !user.emailVerifiedAt) {
      return genericResponse;
    }

    const token = randomUUID();
    const tokenHash = hashOpaqueToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1_000);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      }),
    ]);

    const result = await this.mailService.sendPasswordResetEmail({
      email: user.email,
      fullName: user.fullName,
      token,
    });

    await this.logAudit({
      event: 'auth.password_reset_requested',
      userId: user.id,
      targetType: 'user',
      targetId: user.id,
    });

    return {
      ...genericResponse,
      ...(this.configService.getOrThrow<string>('NODE_ENV') !== 'production'
        ? { resetUrl: result.url }
        : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = hashOpaqueToken(dto.token);
    const password = this.pickRequired(dto.password, dto.senha, 'senha');
    const resetRecord = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, userId: true },
    });

    if (!resetRecord) {
      throw new BadRequestException(
        'Token de redefinicao invalido ou expirado.',
      );
    }

    const passwordHash = await argon2.hash(password, passwordOptions);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: resetRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.logAudit({
      event: 'auth.password_reset',
      userId: resetRecord.userId,
      targetType: 'user',
      targetId: resetRecord.userId,
    });

    return {
      message: 'Senha redefinida com sucesso. Faca login com a nova senha.',
    };
  }

  async login(dto: LoginDto, requestMeta: RequestMeta) {
    const email = dto.email.trim().toLowerCase();
    const password = this.pickRequired(dto.password, dto.senha, 'senha');
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        profile: true,
        phone: true,
        avatarUrl: true,
        emailVerifiedAt: true,
        createdAt: true,
        passwordHash: true,
        deletedAt: true,
      },
    });

    if (!user) {
      await this.logAudit({
        event: 'auth.login_failed',
        metadata: { email, reason: 'user_not_found' },
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      });
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('Esta conta foi encerrada.');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, password);
    if (!passwordMatches) {
      await this.logAudit({
        event: 'auth.login_failed',
        userId: user.id,
        targetType: 'user',
        targetId: user.id,
        metadata: { email: user.email, reason: 'invalid_password' },
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      });
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    if (!user.emailVerifiedAt) {
      await this.logAudit({
        event: 'auth.login_failed',
        userId: user.id,
        targetType: 'user',
        targetId: user.id,
        metadata: { email: user.email, reason: 'email_not_verified' },
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      });
      throw new UnauthorizedException(
        'Confirme o e-mail da conta antes de fazer login.',
      );
    }

    const tokens = await this.issueTokens(user, requestMeta);

    await this.logAudit({
      event: 'auth.logged_in',
      userId: user.id,
      targetType: 'user',
      targetId: user.id,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    const safeUser = this.serializeUser(user);
    return { user: safeUser, usuario: this.serializeUserPt(user), ...tokens };
  }

  async refresh(dto: RefreshTokenDto, requestMeta: RequestMeta) {
    const refreshToken = this.pickRequired(
      dto.refreshToken,
      dto.refresh_token,
      'refresh_token',
    );
    const refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        refreshToken,
        {
          secret: refreshSecret,
        },
      );
    } catch {
      throw new UnauthorizedException('Refresh token invalido.');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token invalido.');
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            profile: true,
            phone: true,
            avatarUrl: true,
            emailVerifiedAt: true,
            createdAt: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!storedToken || storedToken.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token expirado ou revogado.');
    }

    if (storedToken.revokedAt) {
      await this.handleRefreshTokenReuse(
        storedToken.userId,
        storedToken.id,
        requestMeta,
      );
      throw new UnauthorizedException('Refresh token expirado ou revogado.');
    }

    if (storedToken.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token expirado ou revogado.');
    }

    if (storedToken.user.deletedAt) {
      throw new UnauthorizedException('Esta conta foi encerrada.');
    }

    const refreshMatches = await argon2.verify(
      storedToken.hashedToken,
      refreshToken,
    );
    if (!refreshMatches) {
      await this.handleRefreshTokenReuse(
        storedToken.userId,
        storedToken.id,
        requestMeta,
      );
      throw new UnauthorizedException('Refresh token invalido.');
    }

    const tokens = await this.rotateRefreshToken(storedToken, requestMeta);

    await this.logAudit({
      event: 'auth.token_refreshed',
      userId: storedToken.user.id,
      targetType: 'refresh_token',
      targetId: storedToken.id,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    const safeUser = this.serializeUser(storedToken.user);
    return {
      user: safeUser,
      usuario: this.serializeUserPt(storedToken.user),
      ...tokens,
    };
  }

  async logout(userId: string, dto: LogoutDto) {
    const refreshToken = this.pickRequired(
      dto.refreshToken,
      dto.refresh_token,
      'refresh_token',
    );
    const refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        refreshToken,
        {
          secret: refreshSecret,
        },
      );
    } catch {
      throw new UnauthorizedException('Refresh token invalido.');
    }

    if (payload.sub !== userId || payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token invalido.');
    }

    await this.prisma.refreshToken.updateMany({
      where: { id: payload.jti, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.logAudit({
      event: 'auth.logged_out',
      userId,
      targetType: 'refresh_token',
      targetId: payload.jti,
    });

    return { message: 'Sessao encerrada com sucesso.' };
  }

  private async issueTokens(user: SafeUser, requestMeta: RequestMeta) {
    const tokenBundle = await this.buildTokenBundle(user, requestMeta);
    await this.persistRefreshToken(this.prisma, tokenBundle.refreshTokenRecord);
    return tokenBundle.response;
  }

  private async issueEmailVerificationToken(
    userId: string,
    email: string,
    fullName: string,
  ) {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000);

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({
        where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          tokenHash: hashOpaqueToken(token),
          expiresAt,
          user: { connect: { id: userId } },
        },
      }),
    ]);

    const mailResult = await this.mailService.sendVerificationEmail({
      email,
      fullName,
      token,
    });

    return {
      verificationUrl: mailResult.verificationUrl,
      preview: mailResult.preview,
    };
  }

  private serializeUser(user: SafeUser) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      profile: user.profile,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }

  private serializeUserPt(user: SafeUser) {
    return {
      id: user.id,
      nome: user.fullName,
      email: user.email,
      telefone: user.phone,
      perfil:
        user.role === UserRole.ADMIN
          ? 'admin'
          : this.serializeProfile(user.profile),
      foto_url: user.avatarUrl,
      email_verificado_em: user.emailVerifiedAt,
      criado_em: user.createdAt,
    };
  }

  private async logAudit(input: {
    event: string;
    userId?: string | undefined;
    targetType?: string | undefined;
    targetId?: string | undefined;
    metadata?: Prisma.InputJsonValue | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }) {
    const data: Prisma.AuditLogCreateInput = {
      event: input.event,
      ...(input.userId ? { user: { connect: { id: input.userId } } } : {}),
      ...(input.targetType ? { targetType: input.targetType } : {}),
      ...(input.targetId ? { targetId: input.targetId } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    };

    await this.prisma.auditLog.create({ data });
  }

  private async rotateRefreshToken(
    storedToken: {
      id: string;
      userId: string;
      user: SafeUser;
      expiresAt: Date;
    },
    requestMeta: RequestMeta,
  ) {
    const tokenBundle = await this.buildTokenBundle(
      storedToken.user,
      requestMeta,
    );

    await this.prisma.$transaction(async (tx) => {
      const revocation = await tx.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          userId: storedToken.userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      });

      if (revocation.count !== 1) {
        throw new UnauthorizedException('Refresh token expirado ou revogado.');
      }

      await this.persistRefreshToken(tx, tokenBundle.refreshTokenRecord);
    });

    return tokenBundle.response;
  }

  private async buildTokenBundle(user: SafeUser, requestMeta: RequestMeta) {
    const accessSecret =
      this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessTtl = this.configService.getOrThrow<string>('JWT_ACCESS_TTL');
    const refreshTtl = this.configService.getOrThrow<string>('JWT_REFRESH_TTL');

    const refreshTokenId = randomUUID();
    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      profile: user.profile,
      type: 'access',
    };
    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      profile: user.profile,
      jti: refreshTokenId,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: accessSecret,
        expiresIn: accessTtl as StringValue,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshTtl as StringValue,
      }),
    ]);

    return {
      response: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer' as const,
        expiresIn: Math.floor(parseDurationToMs(accessTtl) / 1_000),
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer' as const,
        expira_em: Math.floor(parseDurationToMs(accessTtl) / 1_000),
      },
      refreshTokenRecord: {
        id: refreshTokenId,
        user: { connect: { id: user.id } },
        hashedToken: await argon2.hash(refreshToken, passwordOptions),
        expiresAt: new Date(Date.now() + parseDurationToMs(refreshTtl)),
        ...(requestMeta.ipAddress ? { ipAddress: requestMeta.ipAddress } : {}),
        ...(requestMeta.userAgent ? { userAgent: requestMeta.userAgent } : {}),
      } satisfies Prisma.RefreshTokenCreateInput,
    };
  }

  private async persistRefreshToken(
    prisma: Prisma.TransactionClient | PrismaService,
    data: Prisma.RefreshTokenCreateInput,
  ) {
    await prisma.refreshToken.create({ data });
  }

  private async handleRefreshTokenReuse(
    userId: string,
    suspectTokenId: string,
    requestMeta: RequestMeta,
  ) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.logAudit({
      event: 'auth.refresh_token_reuse_detected',
      userId,
      targetType: 'refresh_token',
      targetId: suspectTokenId,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
  }

  private mapProfile(value: string | undefined): UserProfile {
    if (!value) return UserProfile.ANUNCIANTE;
    const normalized = value.trim().toLowerCase();
    return normalized === 'comprador'
      ? UserProfile.COMPRADOR
      : UserProfile.ANUNCIANTE;
  }

  private serializeProfile(profile: UserProfile): 'anunciante' | 'comprador' {
    return profile === UserProfile.COMPRADOR ? 'comprador' : 'anunciante';
  }

  private normalizeCpfCnpj(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const digits = value.trim().replace(/\D/g, '');
    if (digits.length === 0) return undefined;
    if (digits.length !== 11 && digits.length !== 14) {
      throw new BadRequestException('CPF ou CNPJ invalido.');
    }
    if (digits.length === 11 && !this.isValidCpf(digits)) {
      throw new BadRequestException('CPF invalido.');
    }
    if (digits.length === 14 && !this.isValidCnpj(digits)) {
      throw new BadRequestException('CNPJ invalido.');
    }
    return digits;
  }

  private pickRequired(
    canonical: string | undefined,
    alias: string | undefined,
    fieldName: string,
  ): string {
    const value = canonical ?? alias;
    if (!value) {
      throw new BadRequestException(`Campo obrigatorio ausente: ${fieldName}.`);
    }
    return value;
  }

  private isValidCpf(cpf: string): boolean {
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    const calc = (slice: string, factor: number) => {
      let sum = 0;
      for (const ch of slice) sum += Number(ch) * factor--;
      const rest = (sum * 10) % 11;
      return rest === 10 ? 0 : rest;
    };
    const d1 = calc(cpf.slice(0, 9), 10);
    const d2 = calc(cpf.slice(0, 10), 11);
    return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
  }

  private isValidCnpj(cnpj: string): boolean {
    if (/^(\d)\1{13}$/.test(cnpj)) return false;
    const calc = (slice: string, weights: number[]) => {
      let sum = 0;
      for (let i = 0; i < weights.length; i++)
        sum += Number(slice[i]) * weights[i]!;
      const rest = sum % 11;
      return rest < 2 ? 0 : 11 - rest;
    };
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const d1 = calc(cnpj.slice(0, 12), w1);
    const d2 = calc(cnpj.slice(0, 13), w2);
    return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
  }
}
