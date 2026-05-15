import { UserProfile, UserRole } from '@prisma/client';

export type JwtAccessPayload = {
  sub: string;
  email: string;
  role: UserRole;
  profile: UserProfile;
  type: 'access';
};

export type JwtRefreshPayload = {
  sub: string;
  email: string;
  role: UserRole;
  profile: UserProfile;
  jti: string;
  type: 'refresh';
};
