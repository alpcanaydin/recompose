import type { Settings } from '@recompose/contracts';

type Choice<Value extends string> = { value: Value; label: string };

export const themeChoices: readonly Choice<Settings['theme']>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export const logRetentionChoices: readonly Choice<'7' | '30' | '90'>[] = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];
