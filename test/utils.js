exports.getCookieHeaders = (cookies) =>
  cookies
    .flatMap((c) => c.split(';'))
    .flatMap((c) => c.trim().split('='))
    .filter((_, i) => i % 2 === 0);
