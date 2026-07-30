import { expect, within } from 'storybook/test';

import preview from '#.storybook/preview';

import { StatusIndicator } from './index';

const transparent = 'rgba(0, 0, 0, 0)';

async function marksTheState(canvasElement: HTMLElement, state: string) {
  const mark = await within(canvasElement).findByRole('img', { name: state });
  const painted = getComputedStyle(mark);

  await expect(painted.backgroundColor).not.toBe(transparent);
  await expect(painted.borderTopWidth).toBe('0px');
  await expect(mark.getBoundingClientRect().width).toBe(6);
}

const meta = preview.meta({
  component: StatusIndicator,
});

/** A gateway that is serving right now. */
export const Running = meta.story({
  args: { status: 'running' },
  play: async ({ canvasElement }) => {
    await marksTheState(canvasElement, 'Running');
  },
});

/** A gateway that holds no port. */
export const Stopped = meta.story({
  args: { status: 'stopped' },
  play: async ({ canvasElement }) => {
    await marksTheState(canvasElement, 'Stopped');
  },
});

/** The two states side by side, where the color alone tells them apart. */
export const BothStates = meta.story({
  args: { status: 'running' },
  render: () => (
    <div className="flex gap-2">
      <StatusIndicator status="running" />
      <StatusIndicator status="stopped" />
    </div>
  ),
  play: async ({ canvas }) => {
    const serving = await canvas.findByRole('img', { name: 'Running' });
    const halted = await canvas.findByRole('img', { name: 'Stopped' });

    await expect(getComputedStyle(serving).backgroundColor).not.toBe(
      getComputedStyle(halted).backgroundColor,
    );
  },
});
