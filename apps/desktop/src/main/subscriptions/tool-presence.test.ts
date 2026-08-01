import type { SubscriptionTool } from '@recompose/contracts';

import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';

import { subscriptionHomes, type SubscriptionHomes } from './subscription-homes';
import { reportTools } from './tool-presence';

let userDataPath: string;
let binFolder: string;
let homes: SubscriptionHomes;

async function installed(name: string): Promise<void> {
  const binary = join(binFolder, name);

  await writeFile(binary, '#!/bin/sh\nexit 0\n', 'utf8');
  await chmod(binary, 0o755);
}

async function droppedInButNotRunnable(name: string): Promise<void> {
  await writeFile(join(binFolder, name), 'not runnable\n', 'utf8');
  await chmod(join(binFolder, name), 0o644);
}

function toolFor(
  tools: readonly SubscriptionTool[],
  provider: SubscriptionTool['provider'],
): SubscriptionTool | undefined {
  return tools.find((tool) => tool.provider === provider);
}

beforeEach(async () => {
  userDataPath = await mkdtemp(join(tmpdir(), 'recompose-tools-'));
  binFolder = await mkdtemp(join(tmpdir(), 'recompose-bin-'));
  homes = subscriptionHomes(userDataPath, 'darwin');
});

describe('reporting which provider tools this machine can run', () => {
  test('given no tool anywhere on the search path, every tool reports absent', async () => {
    const tools = await reportTools({ homes, searchPath: binFolder, platform: 'darwin' });

    expect(tools.map((tool) => tool.present)).toEqual([false, false]);
    expect(tools.map((tool) => tool.provider)).toEqual(['anthropic', 'openai']);
  });

  test('given a tool installed on the search path, that tool reports present', async () => {
    await installed('claude');

    const tools = await reportTools({
      homes,
      searchPath: [binFolder, '/nowhere'].join(delimiter),
      platform: 'darwin',
    });

    expect(toolFor(tools, 'anthropic')?.present).toBe(true);
    expect(toolFor(tools, 'openai')?.present).toBe(false);
  });

  test('given a file that shares the tool name but cannot run, the tool reports absent', async () => {
    await droppedInButNotRunnable('codex');

    const tools = await reportTools({ homes, searchPath: binFolder, platform: 'darwin' });

    expect(toolFor(tools, 'openai')?.present).toBe(false);
  });

  test('given a blank search path, every tool reports absent rather than failing', async () => {
    const tools = await reportTools({ homes, searchPath: '', platform: 'darwin' });

    expect(tools.map((tool) => tool.present)).toEqual([false, false]);
  });

  test('given any tool, the report carries its name and the two lines a person needs', async () => {
    const tools = await reportTools({ homes, searchPath: binFolder, platform: 'darwin' });

    expect(toolFor(tools, 'anthropic')).toEqual({
      provider: 'anthropic',
      toolName: 'Claude Code',
      present: false,
      signInCommand: `CLAUDE_CONFIG_DIR="${homes.pendingHomeFor('anthropic')}" claude`,
      shellSetupLine: `export CLAUDE_CONFIG_DIR="$(readlink -f "${homes.activePointerFor('anthropic')}")"`,
    });
  });
});

describe('reporting tools on Windows, where a shim stands in for the binary', () => {
  test('given a command shim on the search path, the tool counts as present', async () => {
    await droppedInButNotRunnable('claude.cmd');

    const tools = await reportTools({ homes, searchPath: binFolder, platform: 'win32' });

    expect(toolFor(tools, 'anthropic')?.present).toBe(true);
  });

  test('given several folders, the search path is split on the separator Windows uses', async () => {
    await droppedInButNotRunnable('claude.cmd');

    const tools = await reportTools({
      homes,
      searchPath: ['C:\\nowhere', binFolder].join(';'),
      platform: 'win32',
    });

    expect(toolFor(tools, 'anthropic')?.present).toBe(true);
  });

  test('given a folder holding no shim, the folder itself never counts as the tool', async () => {
    const tools = await reportTools({ homes, searchPath: binFolder, platform: 'win32' });

    expect(tools.map((tool) => tool.present)).toEqual([false, false]);
  });
});
