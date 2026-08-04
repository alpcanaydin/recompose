import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';

import { BrandMark } from './brand-mark';
import { brandMarkNames } from './brand-mark-inventory';

function drawingsIn(container: Element): readonly SVGSVGElement[] {
  return [...container.querySelectorAll('svg')];
}

test('the mark beside a provider name adds nothing that name already says', async () => {
  await render(
    <h2>
      <BrandMark name="anthropic" />
      Anthropic
    </h2>,
  );

  await expect.element(page.getByRole('heading', { name: 'Anthropic' })).toBeVisible();
});

test('every vendor the catalog can name is drawn by a mark of its own', async () => {
  const screen = await render(
    <>
      {brandMarkNames.map((name) => (
        <BrandMark key={name} name={name} />
      ))}
    </>,
  );

  const shapes = new Set(drawingsIn(screen.container).map((drawing) => drawing.innerHTML));

  expect(shapes.size).toBe(brandMarkNames.length);
});

test('the vendors this release connects to and the ones it awaits are all in the inventory', () => {
  expect(brandMarkNames).toContain('ollama');
  expect(brandMarkNames).toContain('together');
  expect(brandMarkNames).toContain('cerebras');
  expect(brandMarkNames).toContain('githubCopilot');
});

test('a mark stays out of the accessibility tree, so a row keeps the one name it prints', async () => {
  const screen = await render(
    <>
      {brandMarkNames.map((name) => (
        <BrandMark key={name} name={name} variant="mono" />
      ))}
    </>,
  );

  for (const drawing of drawingsIn(screen.container)) {
    expect(drawing).toHaveAttribute('aria-hidden');
  }
});

test('the mono variant takes the ink around it rather than the vendor own colors', async () => {
  const screen = await render(
    <span style={{ color: 'rgb(10, 20, 30)' }}>
      {brandMarkNames.map((name) => (
        <BrandMark key={name} name={name} variant="mono" />
      ))}
    </span>,
  );

  for (const drawing of drawingsIn(screen.container)) {
    expect(getComputedStyle(drawing).fill).toBe('rgb(10, 20, 30)');
  }
});

test('a vendor that publishes a color mark draws something other than its monochrome one', async () => {
  const screen = await render(
    <>
      <BrandMark name="together" variant="color" />
      <BrandMark name="together" variant="mono" />
    </>,
  );

  const [color, mono] = drawingsIn(screen.container);

  expect(color?.innerHTML).not.toBe(mono?.innerHTML);
});

test('a vendor whose mark is monochrome draws that one mark under either variant', async () => {
  const screen = await render(
    <>
      <BrandMark name="anthropic" variant="color" />
      <BrandMark name="anthropic" variant="mono" />
    </>,
  );

  const [color, mono] = drawingsIn(screen.container);

  expect(color?.innerHTML).toBe(mono?.innerHTML);
});

test('the marks share one drawing box, so a column of providers lines up', async () => {
  const screen = await render(
    <>
      {brandMarkNames.map((name) => (
        <BrandMark key={name} name={name} />
      ))}
    </>,
  );

  const boxes = new Set(drawingsIn(screen.container).map((mark) => mark.getAttribute('viewBox')));

  expect([...boxes]).toEqual(['0 0 24 24']);
});
