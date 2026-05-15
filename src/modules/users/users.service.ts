import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserProfile } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  profile: true,
  phone: true,
  avatarUrl: true,
  cpfCnpj: true,
  emailVerifiedAt: true,
  termsAcceptedAt: true,
  privacyAcceptedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findMe(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId, deletedAt: null },
      select: userSelect,
    });
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const exists = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });

    if (!exists) throw new NotFoundException('Usuario nao encontrado.');

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined || dto.nome !== undefined
          ? { fullName: (dto.fullName ?? dto.nome)!.trim() }
          : {}),
        ...(dto.phone !== undefined || dto.telefone !== undefined
          ? { phone: (dto.phone ?? dto.telefone)?.trim() ?? null }
          : {}),
        ...(dto.avatarUrl !== undefined || dto.avatar_url !== undefined
          ? { avatarUrl: dto.avatarUrl ?? dto.avatar_url ?? null }
          : {}),
        ...(dto.perfil !== undefined
          ? { profile: this.mapProfile(dto.perfil) }
          : {}),
      },
      select: userSelect,
    });
  }

  async deleteMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });

    if (!user) throw new NotFoundException('Usuario nao encontrado.');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return {
      message:
        'Conta encerrada. Seus dados serao anonimizados em ate 15 dias conforme a LGPD Art. 18.',
      };
  }

  private mapProfile(value: string): UserProfile {
    return value.trim().toLowerCase() === 'comprador'
      ? UserProfile.COMPRADOR
      : UserProfile.ANUNCIANTE;
  }
}
