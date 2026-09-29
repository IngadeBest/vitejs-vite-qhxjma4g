export function isRecoveryLocation(location) {
  const paths = ['/nieuw-wachtwoord', '/reset-password', '/update-password'];
  const hash = (location.hash || '').replace(/^#/, '');
  const params = new URLSearchParams(location.search || '');
  const hashParams = new URLSearchParams(hash.startsWith('/') ? hash.split('?')[1] || '' : hash);
  for (const [key, value] of hashParams) params.set(key, value);
  return paths.includes(location.pathname) || paths.includes(hash.split('?')[0])
    || params.get('type') === 'recovery'
    || (location.pathname === '/' && params.has('code'))
    || params.get('error_code') === 'otp_expired';
}
