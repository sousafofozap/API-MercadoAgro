import { FastifyRequest } from 'fastify';

import { getClientIp } from './client-ip';

export type RequestMeta = {
  ipAddress: string | undefined;
  userAgent: string | undefined;
};

export function getRequestMeta(request: FastifyRequest): RequestMeta {
  const rawUserAgent = request.headers['user-agent'];

  return {
    ipAddress: getClientIp(request),
    userAgent: Array.isArray(rawUserAgent)
      ? rawUserAgent.join(', ')
      : rawUserAgent,
  };
}
