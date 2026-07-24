const CSP_PLACEHOLDER = '__CSP__';

export function contentSecurityPolicy(mode: 'serve' | 'build'): string {
  const styleSrc = mode === 'serve' ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'";

  return ["default-src 'self'", "script-src 'self'", styleSrc, "img-src 'self' data:"].join('; ');
}

export function injectContentSecurityPolicy(html: string, mode: 'serve' | 'build'): string {
  if (!html.includes(CSP_PLACEHOLDER)) {
    throw new Error(
      'index.html is missing the __CSP__ placeholder, cannot inject the content security policy',
    );
  }

  return html.replace(CSP_PLACEHOLDER, contentSecurityPolicy(mode));
}
