import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const macOsTextStyleSizes = [26, 22, 17, 15, 13, 12, 11, 10].map((point) => `${point}px`);

const themeCss = readFileSync(new URL('./theme.css', import.meta.url), 'utf8');

function declaredTypeSizes(css: string): { token: string; size: string }[] {
  return [...css.matchAll(/--text-([a-z-]+):\s*([^;]+);/g)]
    .filter(([, token]) => token !== undefined && !token.includes('--'))
    .map(([, token, size]) => ({ token: `--text-${token ?? ''}`, size: (size ?? '').trim() }))
    .filter(({ size }) => size !== 'initial');
}

function literalFontSizes(css: string): string[] {
  return [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map(([, size]) => size ?? '');
}

function offScaleTokens(css: string): { token: string; size: string }[] {
  return declaredTypeSizes(css).filter(({ size }) => !macOsTextStyleSizes.includes(size));
}

describe('the type scale', () => {
  it('offers only sizes macOS itself sets a text style at', () => {
    expect(offScaleTokens(themeCss)).toEqual([]);
  });

  it('spends every size through a token, so no rule can hide one from the scale', () => {
    expect(literalFontSizes(themeCss)).toEqual([]);
  });
});
