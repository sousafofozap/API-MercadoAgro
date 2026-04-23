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
import { Prisma, UserRole } from '@prisma/client';
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
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

type SafeUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
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
    const phone = dto.phone?.trim();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Ja existe uma conta cadastrada com este e-mail.');
    }

    const passwordHash = await argon2.hash(dto.password, passwordOptions);

    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: dto.fullName.trim(),
        role: PUBLIC_USER_ROLE,
        ...(phone ? { phone } : {}),
        passwordHash,
      },
    });

    const { verificationUrl } =
      await this.issueEmailVerificationToken(user.id, user.email, user.fullName);

    await this.logAudit({
      event: 'auth.registered',
      userId: user.id,
      targetType: 'user',
      targetId: user.id,
      metadata: {
        email: user.email,
        role: user.role,
      },
    });

    return {
      message: 'Cadastro realizado. Confirme o e-mail antes de acessar a plataforma.',
      email: user.email,
      role: user.role,
      ...(this.configService.getOrThrow<string>('NODE_ENV') !== 'production'
        ? { verificationUrl }
        : {}),
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const tokenHash = hashOpaqueToken(dto.token);
    const verificationRecord = await this.prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!verificationRecord) {
      throw new BadRequestException('Token de verificacao invalido ou expirado.');
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

    return {
      message: 'E-mail verificado com sucesso.',
    };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        emailVerifiedAt: true,
      },
    });

    if (!user || user.emailVerifiedAt) {
      return {
        message:
          'Se existir uma conta pendente para este e-mail, um novo link de verificacao sera enviado.',
      };
    }

    const { verificationUrl } =
      await this.issueEmailVerificationToken(user.id, user.email, user.fullName);

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

  async login(dto: LoginDto, requestMeta: RequestMeta) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        avatarUrl: true,
        emailVerifiedAt: true,
        createdAt: true,
        passwordHash: true,
      },
    });

    if (!user) {
      await this.logAudit({
        event: 'auth.login_failed',
        metadata: {
          email,
          reason: 'user_not_found',
        },
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      });
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordMatches) {
      await this.logAudit({
        event: 'auth.login_failed',
        userId: user.id,
        targetType: 'user',
        targetId: user.id,
        metadata: {
          email: user.email,
          reason: 'invalid_password',
        },
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
        metadata: {
          email: user.email,
          reason: 'email_not_verified',
        },
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

    return {
      user: this.serializeUser(user),
      ...tokens,
    };
  }

  async refresh(dto: RefreshTokenDto, requestMeta: RequestMeta) {
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        dto.refreshToken,
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
            phone: true,
            avatarUrl: true,
            emailVerifiedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (
      !storedToken ||
      storedToken.userId !== payload.sub ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Refresh token expirado ou revogado.');
    }

    const refreshMatches = await argon2.verify(
      storedToken.hashedToken,
      dto.refreshToken,
    );
    if (!refreshMatches) {
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

    return {
      user: this.serializeUser(storedToken.user),
      ...tokens,
    };
  }

  async logout(userId: string, dto: LogoutDto) {
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        dto.refreshToken,
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
      where: {
        id: payload.jti,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.logAudit({
      event: 'auth.logged_out',
      userId,
      targetType: 'refresh_token',
      targetId: payload.jti,
    });

    return {
      message: 'Sessao encerrada com sucesso.',
    };
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
        where: {
          userId,
          consumedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        data: {
          consumedAt: new Date(),
        },
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          tokenHash: hashOpaqueToken(token),
          expiresAt,
          user: {
            connect: {
              id: userId,
            },
          },
        },
      }),
    ]);

    const mailResult = await this.mailService.sendVerificationEmail({
      email,
      fullName,
      token,
    });

    return {
      token,
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
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
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
      ...(input.userId
        ? {
            user: {
              connect: {
                id: input.userId,
              },
            },
          }
        : {}),
      ...(input.targetType ? { targetType: input.targetType } : {}),
      ...(input.targetId ? { targetId: input.targetId } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    };

    await this.prisma.auditLog.create({
      data,
    });
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
    const tokenBundle = await this.buildTokenBundle(storedToken.user, requestMeta);

    await this.prisma.$transaction(async (tx) => {
      const revocation = await tx.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          userId: storedToken.userId,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        data: {
          revokedAt: new Date(),
        },
      });

      if (revocation.count !== 1) {
        throw new UnauthorizedException('Refresh token expirado ou revogado.');
      }

      await this.persistRefreshToken(tx, tokenBundle.refreshTokenRecord);
    });

    return tokenBundle.response;
  }

  private async buildTokenBundle(user: SafeUser, requestMeta: RequestMeta) {
    const accessSecret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessTtl = this.configService.getOrThrow<string>('JWT_ACCESS_TTL');
    const refreshTtl = this.configService.getOrThrow<string>('JWT_REFRESH_TTL');
    const accessExpiresIn = accessTtl as StringValue;
    const refreshExpiresIn = refreshTtl as StringValue;

    const refreshTokenId = randomUUID();
    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };
    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: refreshTokenId,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return {
      response: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer' as const,
        expiresIn: Math.floor(parseDurationToMs(accessTtl) / 1_000),
      },
      refreshTokenRecord: {
        id: refreshTokenId,
        user: {
          connect: {
            id: user.id,
          },
        },
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
}
