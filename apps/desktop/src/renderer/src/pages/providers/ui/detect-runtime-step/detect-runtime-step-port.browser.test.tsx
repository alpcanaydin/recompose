import { expect, test } from 'vitest';

import {
  commitPort,
  lookAnsweringOnPort,
  lookRecordingPorts,
  renderStep,
  typePortDraft,
  walkAwayFromThePort,
} from '../../testing/detect-runtime-step.testkit';

test('the port field stands prefilled with the documented port', async () => {
  const screen = await renderStep({ reachability: { verdict: 'answers', version: '0.5.1' } });

  await expect.element(screen.getByRole('textbox', { name: 'Port' })).toHaveValue('11434');
});

test('a moved port answers through the port field, and the sentence carries that port', async () => {
  const screen = await renderStep({
    overrides: { 'accounts:detect-runtime': lookAnsweringOnPort(9000, '0.6.2') },
  });

  await expect
    .element(
      screen.getByText("Ollama isn't running at 127.0.0.1:11434. Start it, then check again."),
    )
    .toBeVisible();

  await commitPort('9000');

  await expect.element(screen.getByText('Ollama is running at 127.0.0.1:9000.')).toBeVisible();
  await expect.element(screen.getByText('Version 0.6.2')).toBeVisible();
});

test('typing a port digit by digit fires no look until Enter commits it', async () => {
  const recorder = lookRecordingPorts({ verdict: 'answers', version: '0.5.1' });
  const screen = await renderStep({ overrides: { 'accounts:detect-runtime': recorder.look } });

  await expect.element(screen.getByText('Ollama is running at 127.0.0.1:11434.')).toBeVisible();

  await typePortDraft('9000');

  expect(recorder.looked).toEqual([11434]);

  await commitPort('9000');

  await expect.element(screen.getByText('Ollama is running at 127.0.0.1:9000.')).toBeVisible();
  expect(recorder.looked).toEqual([11434, 9000]);
});

test('the reading and its acts hold the screen while a port is being typed', async () => {
  const screen = await renderStep({ reachability: { verdict: 'answers', version: '0.5.1' } });

  await expect.element(screen.getByText('Ollama is running at 127.0.0.1:11434.')).toBeVisible();

  await typePortDraft('9000');

  await expect.element(screen.getByText('Ollama is running at 127.0.0.1:11434.')).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Add Ollama' })).toBeVisible();
});

test('leaving the field commits the typed port', async () => {
  const screen = await renderStep({ reachability: { verdict: 'answers', version: '0.5.1' } });

  await expect.element(screen.getByText('Ollama is running at 127.0.0.1:11434.')).toBeVisible();

  await typePortDraft('9000');
  await walkAwayFromThePort();

  await expect.element(screen.getByText('Ollama is running at 127.0.0.1:9000.')).toBeVisible();
});

test('an invalid port draft holds Add on the answers face too', async () => {
  const screen = await renderStep({ reachability: { verdict: 'answers', version: '0.5.1' } });

  await expect.element(screen.getByRole('button', { name: 'Add Ollama' })).toBeVisible();

  await screen.getByRole('textbox', { name: 'Port' }).fill('70000');

  await expect.element(screen.getByRole('button', { name: 'Add Ollama' })).toBeDisabled();
});

test('port 80 keeps its :80 in the sentence the surface reads', async () => {
  const screen = await renderStep({ reachability: { verdict: 'answers', version: '0.5.1' } });

  await commitPort('80');

  await expect.element(screen.getByText('Ollama is running at 127.0.0.1:80.')).toBeVisible();
});

test('silence at a moved port names the port the look went to', async () => {
  const screen = await renderStep();

  await commitPort('9000');

  await expect
    .element(
      screen.getByText("Ollama isn't running at 127.0.0.1:9000. Start it, then check again."),
    )
    .toBeVisible();
});

test('a stranger at a moved port names the port it answered on', async () => {
  const screen = await renderStep({ reachability: { verdict: 'unrecognized', status: 404 } });

  await commitPort('9000');

  await expect
    .element(screen.getByText('Another server answered at 127.0.0.1:9000.'))
    .toBeVisible();
});

test('a port no loopback server can bind refuses under the field and holds the adds', async () => {
  const screen = await renderStep();

  await expect
    .element(
      screen.getByText("Ollama isn't running at 127.0.0.1:11434. Start it, then check again."),
    )
    .toBeVisible();

  await screen.getByRole('textbox', { name: 'Port' }).fill('70000');

  await expect.element(screen.getByText('Accepts 1 through 65535.')).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Add anyway' })).toBeDisabled();
  await expect
    .element(
      screen.getByText("Ollama isn't running at 127.0.0.1:11434. Start it, then check again."),
    )
    .toBeVisible();
});
