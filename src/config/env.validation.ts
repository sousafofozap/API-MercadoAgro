type RuntimeEnv = {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  APP_NAME: string;
  API_PREFIX: string;
  TRUST_PROXY: boolean;
  DATABASE_URL: string;
  DIRECT_URL: string;
  REDIS_ENABLED: boolean;
  REDIS_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL: string;
  CORS_ORIGINS: string[];
  THROTTLE_TTL_MS: number;
  THROTTLE_LIMIT: number;
  PUBLIC_THROTTLE_LIMIT: number;
  MAIL_DRIVER: 'logger' | 'smtp';
  MAIL_FROM_NAME: string;
  MAIL_FROM_ADDRESS: string;
  MAIL_REPLY_TO: string;
  EMAIL_VERIFICATION_URL_TEMPLATE: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
};

function ensureString(
  value: string | undefined,
  key: string,
  fallback?: string,
): string {
  const resolved = value?.trim() || fallback;

  if (!resolved) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${key}`);
  }

  return resolved;
}

function ensureSecret(value: string | undefined, key: string): string {
  const secret = ensureString(value, key);

  if (secret.length < 32) {
    throw new Error(
      `${key} deve ter no minimo 32 caracteres para garantir seguranca criptografica`,
    );
  }

  return secret;
}

function ensureNumber(
  value: string | undefined,
  key: string,
  fallback: number,
): number {
  const resolved = Number(value ?? fallback);

  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new Error(`Variavel de ambiente invalida para ${key}: ${value}`);
  }

  return resolved;
}

function ensureDuration(value: string | undefined, key: string, fallback: string) {
  const resolved = value?.trim() || fallback;

  if (!/^\d+(ms|s|m|h|d)$/.test(resolved)) {
    throw new Error(
      `Variavel de ambiente invalida para ${key}: use valores como 15m, 30d, 60s`,
    );
  }

  return resolved;
}

function ensureBoolean(
  value: string | undefined,
  key: string,
  fallback: boolean,
): boolean {
  const resolved = (value ?? String(fallback)).trim().toLowerCase();

  if (!['true', 'false'].includes(resolved)) {
    throw new Error(`Variavel de ambiente invalida para ${key}: ${value}`);
  }

  return resolved === 'true';
}

export function validateEnv(env: Record<string, string | undefined>): RuntimeEnv {
  const nodeEnv =
    (env.NODE_ENV as RuntimeEnv['NODE_ENV'] | undefined) ?? 'development';
  const mailDriver =
    (env.MAIL_DRIVER as RuntimeEnv['MAIL_DRIVER'] | undefined) ?? 'logger';

  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error(`NODE_ENV invalido: ${env.NODE_ENV}`);
  }

  if (!['logger', 'smtp'].includes(mailDriver)) {
    throw new Error(`MAIL_DRIVER invalido: ${env.MAIL_DRIVER}`);
  }

  if (mailDriver === 'smtp') {
    ensureString(env.SMTP_HOST, 'SMTP_HOST');
    ensureString(env.SMTP_USER, 'SMTP_USER');
    ensureString(env.SMTP_PASS, 'SMTP_PASS');
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: ensureNumber(env.PORT, 'PORT', 3000),
    APP_NAME: ensureString(env.APP_NAME, 'APP_NAME', 'MercadoAgro Mobile API'),
    API_PREFIX: ensureString(env.API_PREFIX, 'API_PREFIX', 'v1'),
    TRUST_PROXY: ensureBoolean(env.TRUST_PROXY, 'TRUST_PROXY', false),
    DATABASE_URL: ensureString(env.DATABASE_URL, 'DATABASE_URL'),
    DIRECT_URL: ensureString(env.DIRECT_URL, 'DIRECT_URL', env.DATABASE_URL),
    REDIS_ENABLED: ensureBoolean(env.REDIS_ENABLED, 'REDIS_ENABLED', false),
    REDIS_URL: ensureString(env.REDIS_URL, 'REDIS_URL', 'redis://localhost:6379'),
    JWT_ACCESS_SECRET: ensureSecret(env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: ensureSecret(env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET'),
    JWT_ACCESS_TTL: ensureDuration(env.JWT_ACCESS_TTL, 'JWT_ACCESS_TTL', '15m'),
    JWT_REFRESH_TTL: ensureDuration(env.JWT_REFRESH_TTL, 'JWT_REFRESH_TTL', '30d'),
    CORS_ORIGINS: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    THROTTLE_TTL_MS: ensureNumber(env.THROTTLE_TTL_MS, 'THROTTLE_TTL_MS', 60_000),
    THROTTLE_LIMIT: ensureNumber(env.THROTTLE_LIMIT, 'THROTTLE_LIMIT', 100),
    PUBLIC_THROTTLE_LIMIT: ensureNumber(
      env.PUBLIC_THROTTLE_LIMIT,
      'PUBLIC_THROTTLE_LIMIT',
      20,
    ),
    MAIL_DRIVER: mailDriver,
    MAIL_FROM_NAME: ensureString(env.MAIL_FROM_NAME, 'MAIL_FROM_NAME', 'MercadoAgro'),
    MAIL_FROM_ADDRESS: ensureString(
      env.MAIL_FROM_ADDRESS,
      'MAIL_FROM_ADDRESS',
      'no-reply@mercadoagro.local',
    ),
    MAIL_REPLY_TO: ensureString(
      env.MAIL_REPLY_TO,
      'MAIL_REPLY_TO',
      'support@mercadoagro.local',
    ),
    EMAIL_VERIFICATION_URL_TEMPLATE: ensureString(
      env.EMAIL_VERIFICATION_URL_TEMPLATE,
      'EMAIL_VERIFICATION_URL_TEMPLATE',
      'mercadoagro://verify-email?token={{token}}',
    ),
    SMTP_HOST: env.SMTP_HOST?.trim() ?? '',
    SMTP_PORT: ensureNumber(env.SMTP_PORT, 'SMTP_PORT', 587),
    SMTP_SECURE: ensureBoolean(env.SMTP_SECURE, 'SMTP_SECURE', false),
    SMTP_USER: env.SMTP_USER?.trim() ?? '',
    SMTP_PASS: env.SMTP_PASS?.trim() ?? '',
  };
}
