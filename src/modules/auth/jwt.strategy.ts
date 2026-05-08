import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { JwtAccessPayload } from '../../common/types/jwt-payload.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtAccessPayload) {
    if (payload.type !== 'access' || !payload.sub) {
      throw new UnauthorizedException('Token de acesso invalido.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true, email: true, role: true, emailVerifiedAt: true },
    });

    if (!user || !user.emailVerifiedAt) {
      throw new UnauthorizedException('Token de acesso invalido.');
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    } satisfies JwtAccessPayload;
  }
}
