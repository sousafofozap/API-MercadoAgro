import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { JwtAccessPayload } from '../types/jwt-payload.type';

export const CurrentUser = createParamDecorator(
  (data: keyof JwtAccessPayload | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: JwtAccessPayload }>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
