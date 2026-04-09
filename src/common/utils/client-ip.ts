type RequestWithIp = {
  ip?: string;
  ips?: string[];
};

export function getClientIp(request: RequestWithIp): string | undefined {
  const forwardedIps = Array.isArray(request.ips)
    ? request.ips.map((ip) => ip.trim()).filter(Boolean)
    : [];

  if (forwardedIps.length > 0) {
    return forwardedIps[0];
  }

  return request.ip;
}
