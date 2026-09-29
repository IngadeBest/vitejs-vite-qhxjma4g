import { expect, it } from 'vitest';
import { isRecoveryLocation } from './recoveryLocation';
it('recognizes reset aliases, hash tokens, PKCE codes and expired links before routing', () => {
  for (const url of ['/#/nieuw-wachtwoord', '/reset-password', '/update-password', '/#access_token=test&type=recovery', '/?code=one-use', '/#error_code=otp_expired']) {
    expect(isRecoveryLocation(new URL(url, 'https://app.workingpoint.nl'))).toBe(true);
  }
  for (const url of ['/#/uitslagen', '/results/w', '/#/formulier', '/#access_token=ordinary-login']) {
    expect(isRecoveryLocation(new URL(url, 'https://app.workingpoint.nl'))).toBe(false);
  }
});
