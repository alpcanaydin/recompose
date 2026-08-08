import addonA11y from '@storybook/addon-a11y';
import addonThemes, { withThemeByClassName } from '@storybook/addon-themes';
import { definePreview } from '@storybook/react-vite';
import isChromatic from 'chromatic/isChromatic';

import '../src/renderer/src/app/styles/main.css';
import './preview.css';
import { withRecomposeBridge } from './recompose-bridge';

if (isChromatic()) {
  const motionOff = document.createElement('style');

  motionOff.textContent =
    '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }';
  document.head.append(motionOff);
}

const schemes = { light: 'scheme-light', dark: 'scheme-dark' };

function requestedScheme(globals: Record<string, unknown>): string {
  const theme = globals['theme'];

  return typeof theme === 'string' && theme in schemes ? theme : 'light';
}

export default definePreview({
  addons: [addonA11y(), addonThemes()],
  decorators: [
    withRecomposeBridge,
    withThemeByClassName({
      themes: schemes,
      defaultTheme: 'light',
      parentSelector: 'html',
    }),
  ],
  afterEach: ({ globals }) => {
    const requested = requestedScheme(globals);
    const painted = getComputedStyle(document.body).colorScheme;
    const marked = document.documentElement.classList.contains(`scheme-${requested}`);

    if (!marked || painted !== requested) {
      throw new Error(
        `The story asked for the ${requested} scheme, and the page painted ${painted}.`,
      );
    }
  },
  parameters: {
    a11y: { test: 'error' },
  },
});
