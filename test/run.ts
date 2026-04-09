import {
  testRefreshRejectsTokenReuseRace,
  testRegisterUsesSinglePublicRole,
} from './auth.service.test';
import {
  testClientIpPrefersForwardedAddress,
  testRequestMetaUsesNormalizedClientIp,
} from './request-meta.test';

async function run() {
  const tests: Array<[string, () => Promise<void>]> = [
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
