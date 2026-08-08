import type { IpcResponse } from '@recompose/contracts';

import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { installFakeBridge } from '../../shared/testing';
import { useTitleBarDoubleClick } from './use-title-bar-double-click';

function askedToZoom() {
  const asked = vi
    .fn<() => Promise<IpcResponse<'system:title-bar-double-click'>>>()
    .mockResolvedValue({
      ok: true,
      value: undefined,
    });

  installFakeBridge({ overrides: { 'system:title-bar-double-click': asked } });

  return asked;
}

function Probe() {
  useTitleBarDoubleClick();

  return (
    <div className="app-drag">
      <button className="app-no-drag" type="button">
        Run
      </button>
    </div>
  );
}

function doubleClick(target: Element) {
  target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
}

test('double-clicking the bare drag region asks the window to answer the double-click', async () => {
  const asked = askedToZoom();
  const screen = await render(<Probe />);
  const bar = screen.container.querySelector('.app-drag');

  if (bar === null) {
    throw new Error('the drag region is not on screen');
  }

  doubleClick(bar);

  expect(asked).toHaveBeenCalledTimes(1);
});

test('double-clicking a control that sits in the bar is the control to answer, not the window', async () => {
  const asked = askedToZoom();
  const screen = await render(<Probe />);

  doubleClick(screen.getByRole('button', { name: 'Run' }).element());

  expect(asked).not.toHaveBeenCalled();
});
