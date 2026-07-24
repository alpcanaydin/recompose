import addonA11y from '@storybook/addon-a11y';
import { withThemeByClassName } from '@storybook/addon-themes';
import { definePreview } from '@storybook/react-vite';

import '../src/renderer/src/app/styles/main.css';
import './preview.css';

export default definePreview({
  addons: [addonA11y()],
  decorators: [
    withThemeByClassName({
      themes: { light: 'scheme-light', dark: 'scheme-dark' },
      defaultTheme: 'light',
      parentSelector: 'html',
    }),
  ],
  parameters: {
    a11y: { test: 'error' },
  },
});
