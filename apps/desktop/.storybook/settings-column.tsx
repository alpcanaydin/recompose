import type { Decorator } from '@storybook/react-vite';

import { FieldGroup } from '../src/renderer/src/shared/ui';

export const inSettingsColumn: Decorator = (Story) => (
  <div className="mx-auto w-full max-w-column p-4">
    <Story />
  </div>
);

export function inFieldGroup(heading: string): Decorator {
  const InFieldGroup: Decorator = (Story) => (
    <FieldGroup heading={heading}>
      <Story />
    </FieldGroup>
  );

  return InFieldGroup;
}
