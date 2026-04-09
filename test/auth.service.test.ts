import assert from 'node:assert/strict';

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

import { AuthService } from '../src/modules/auth/auth.service';
import { MailService } from '../src/modules/mail/mail.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';

const PUBLIC_USER_ROLE = 'USER' as UserRole;

function createConfigService(values: Record<string, unknown>) {
  return {
    getOrThrow<T>(key: string) {
      if (!(key in values)) {
        throw new Error(`Missing config key: ${key}`);
      }

      return values[key] as T;
    },
  } as ConfigService;
}

function createJwtService(overrides?: Partial<JwtService>) {
  return {
    signAsync: async (_payload: object, options?: { secret?: string; expiresIn?: string }) =>
      `signed:${options?.secret}:${options?.expiresIn ?? 'none'}`,
    verifyAsync: async () => {
      throw new Error('verifyAsync not mocked');
    },
    ...overrides,
  } as JwtService;
}

function createMailService() {
  return {
    sendVerificationEmail: async ({ token }: { token: string }) => ({
      verificationUrl: `mercadoagro://verify-email?token=${token}`,
      preview: 'logger' as const,
    }),
  } as MailService;
}

export async function testRegisterUsesSinglePublicRole() {
  let createdRole: UserRole | undefined;

  const prisma = {
    user: {
      findUnique: async () => null,
      create: async ({ data }: { data: { role: UserRole; email: string; fullName: string } }) => {
        createdRole = data.role;

        return {
          id: 'user-1',
          email: data.email,
          fullName: data.fullName,
          role: data.role,
        };
      },
    },
    emailVerificationToken: {
      updateMany: async () => ({ count: 0 }),
      create: async () => ({ id: 'verification-1' }),
    },
    auditLog: {
      create: async () => ({ id: 'audit-1' }),
    },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  } as unknown as PrismaService;

  const service = new AuthService(
    prisma,
    createJwtService(),
    createConfigService({ NODE_ENV: 'test' }),
    createMailService(),
  );

  const result = await service.register({
    fullName: 'Pessoa Teste',
    email: 'pessoa@example.com',
    password: 'Senha@123',
    role: UserRole.ADMIN,
  } as never);

  assert.equal(createdRole, PUBLIC_USER_ROLE);
  assert.equal(result.role, PUBLIC_USER_ROLE);
}

export async function testRefreshRejectsTokenReuseRace() {
  const hashedToken = await argon2.hash('refresh-token');

  const prisma = {
    refreshToken: {
      findUnique: async () => ({
        id: 'token-1',
        userId: 'user-1',
        hashedToken,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: 'user-1',
          email: 'user@example.com',
          fullName: 'Pessoa Teste',
          role: PUBLIC_USER_ROLE,
          phone: null,
          avatarUrl: null,
          emailVerifiedAt: new Date(),
          createdAt: new Date(),
        },
      }),
      create: async () => ({ id: 'token-2' }),
    },
    auditLog: {
      create: async () => ({ id: 'audit-1' }),
    },
    $transaction: async (
      callback: (tx: {
        refreshToken: {
          updateMany: (args: unknown) => Promise<{ count: number }>;
          create: (args: unknown) => Promise<unknown>;
        };
      }) => Promise<unknown>,
    ) =>
      callback({
        refreshToken: {
          updateMany: async () => ({ count: 0 }),
          create: async () => ({ id: 'token-2' }),
        },
      }),
  } as unknown as PrismaService;

  const service = new AuthService(
    prisma,
    createJwtService({
      verifyAsync: async () => ({
        sub: 'user-1',
        email: 'user@example.com',
        role: PUBLIC_USER_ROLE,
        jti: 'token-1',
        type: 'refresh',
      }),
    }),
    createConfigService({
      JWT_REFRESH_SECRET: 'refresh-secret',
      JWT_ACCESS_SECRET: 'access-secret',
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '30d',
    }),
    createMailService(),
  );

  await assert.rejects(
    service.refresh(
      { refreshToken: 'refresh-token' },
      { ipAddress: '127.0.0.1', userAgent: 'node:test' },
    ),
    /Refresh token expirado ou revogado/,
  );
}
