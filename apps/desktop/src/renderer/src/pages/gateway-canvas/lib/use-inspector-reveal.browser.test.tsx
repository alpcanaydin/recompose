import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { useInspectorReveal } from './use-inspector-reveal';

const askTheMachine = window.matchMedia.bind(window);

function settleMotion(welcome: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    const answer = askTheMachine(query);

    Object.defineProperty(answer, 'matches', {
      value: query.includes('no-preference') ? welcome : !welcome,
    });

    return answer;
  });
}

function Probe({ open }: { open: boolean }) {
  const inspector = useInspectorReveal(open);

  return (
    <p>
      {inspector.rendered ? 'panel stands' : 'panel gone'}
      {inspector.leaving ? ' · leaving' : ''}
    </p>
  );
}

test('with motion welcome the panel is held on screen while its exit plays', async () => {
  settleMotion(true);

  const screen = await render(<Probe open />);

  await expect.element(screen.getByText('panel stands')).toBeInTheDocument();

  await screen.rerender(<Probe open={false} />);

  await expect.element(screen.getByText('panel stands · leaving')).toBeInTheDocument();
});

test('the panel held for its exit is let go of once the exit has run', async () => {
  settleMotion(true);

  const screen = await render(<Probe open />);

  await screen.rerender(<Probe open={false} />);

  await expect.element(screen.getByText('panel stands · leaving')).toBeInTheDocument();
  await expect.element(screen.getByText('panel gone')).toBeInTheDocument();
});

test('with motion turned down the panel goes at once, waiting on no exit it will not play', async () => {
  settleMotion(false);

  const screen = await render(<Probe open />);

  await screen.rerender(<Probe open={false} />);

  expect(screen.container.textContent).toBe('panel gone');
});
