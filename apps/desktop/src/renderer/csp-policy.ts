export function contentSecurityPolicy(mode: 'serve' | 'build'): string {
  const styleSrc = mode === 'serve' ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'";

  return ["default-src 'self'", "script-src 'self'", styleSrc, "img-src 'self' data:"].join('; ');
}
