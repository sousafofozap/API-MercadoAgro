import assert from 'node:assert/strict';

import { getClientIp } from '../src/common/utils/client-ip';
import { getRequestMeta } from '../src/common/utils/request-meta';

export async function testClientIpPrefersForwardedAddress() {
  assert.equal(
    getClientIp({
      ip: '10.0.0.10',
      ips: ['203.0.113.5', '10.0.0.10'],
    }),
    '203.0.113.5',
  );
}

export async function testRequestMetaUsesNormalizedClientIp() {
  const meta = getRequestMeta({
    ip: '10.0.0.10',
    ips: ['198.51.100.9', '10.0.0.10'],
    headers: {
      'user-agent': 'node:test',
    },
  } as never);

  assert.deepEqual(meta, {
    ipAddress: '198.51.100.9',
    userAgent: 'node:test',
  });
}
