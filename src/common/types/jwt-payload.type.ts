import { UserRole } from '@prisma/client';

export type JwtAccessPayload = {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access';
};

export type JwtRefreshPayload = {
  sub: string;
  email: string;
  role: UserRole;
  jti: string;
  type: 'refresh';
};
