const assert = require('node:assert/strict');
const argon2 = require('argon2');

const { AuthService } = require('../dist/modules/auth/auth.service.js');
const { getClientIp } = require('../dist/common/utils/client-ip.js');
const { getRequestMeta } = require('../dist/common/utils/request-meta.js');

const PUBLIC_USER_ROLE = 'USER';

function createConfigService(values) {
  return {
    getOrThrow(key) {
      if (!(key in values)) {
        throw new Error(`Missing config key: ${key}`);
      }

      return values[key];
    },
  };
}

function createJwtService(overrides = {}) {
  return {
    signAsync: async (_payload, options) =>
      `signed:${options?.secret}:${options?.expiresIn ?? 'none'}`,
    verifyAsync: async () => {
      throw new Error('verifyAsync not mocked');
    },
    ...overrides,
  };
}

function createMailService() {
  return {
    sendVerificationEmail: async ({ token }) => ({
      verificationUrl: `mercadoagro://verify-email?token=${token}`,
      preview: 'logger',
    }),
  };
}

async function testRegisterUsesSinglePublicRole() {
  let createdRole;

  const prisma = {
    user: {
      findUnique: async () => null,
      create: async ({ data }) => {
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
    $transaction: async (operations) => Promise.all(operations),
  };

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
    role: 'ADMIN',
  });

  assert.equal(createdRole, PUBLIC_USER_ROLE);
  assert.equal(result.role, PUBLIC_USER_ROLE);
}

async function testRefreshRejectsTokenReuseRace() {
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
    $transaction: async (callback) =>
      callback({
        refreshToken: {
          updateMany: async () => ({ count: 0 }),
          create: async () => ({ id: 'token-2' }),
        },
      }),
  };

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

async function testClientIpPrefersForwardedAddress() {
  assert.equal(
    getClientIp({
      ip: '10.0.0.10',
      ips: ['203.0.113.5', '10.0.0.10'],
    }),
    '203.0.113.5',
  );
}

async function testRequestMetaUsesNormalizedClientIp() {
  const meta = getRequestMeta({
    ip: '10.0.0.10',
    ips: ['198.51.100.9', '10.0.0.10'],
    headers: {
      'user-agent': 'node:test',
    },
  });

  assert.deepEqual(meta, {
    ipAddress: '198.51.100.9',
    userAgent: 'node:test',
  });
}

async function run() {
  const tests = [
    ['register uses a single public role', testRegisterUsesSinglePublicRole],
    ['refresh rejects token reuse race', testRefreshRejectsTokenReuseRace],
    ['client ip prefers forwarded address', testClientIpPrefersForwardedAddress],
    ['request meta uses normalized client ip', testRequestMetaUsesNormalizedClientIp],
  ];

  for (const [name, fn] of tests) {
    await fn();
    console.log(`PASS ${name}`);
  }
}

run().catch((error) => {
  console.error('FAIL test run');
  console.error(error);
  process.exit(1);
});
