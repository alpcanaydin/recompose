import { describe, expect, test } from 'vitest';

import { shellSetupLineFor, signInCommandFor } from './subscription-commands';

describe('the sign-in command a provider asks the terminal to run', () => {
  test('given Claude Code on a Unix machine, the command points the config home at the sign-in home', () => {
    const command = signInCommandFor({
      provider: 'anthropic',
      home: '/data/subscriptions/anthropic/pending',
      platform: 'darwin',
    });

    expect(command).toBe('CLAUDE_CONFIG_DIR="/data/subscriptions/anthropic/pending" claude');
  });

  test('given Codex, the command carries the sign-in subcommand the tool needs', () => {
    const command = signInCommandFor({
      provider: 'openai',
      home: '/data/subscriptions/openai/pending',
      platform: 'darwin',
    });

    expect(command).toBe('CODEX_HOME="/data/subscriptions/openai/pending" codex login');
  });

  test('given Windows, the command sets the config home the way PowerShell does', () => {
    const command = signInCommandFor({
      provider: 'openai',
      home: 'C:\\data\\subscriptions\\openai\\pending',
      platform: 'win32',
    });

    expect(command).toBe('$env:CODEX_HOME="C:\\data\\subscriptions\\openai\\pending"; codex login');
  });
});

describe('the shell setup line a person pastes to use the active account outside the app', () => {
  test('given a Unix machine, the line resolves the active pointer to the home it stands for', () => {
    const line = shellSetupLineFor({
      provider: 'anthropic',
      pointer: '/data/subscriptions/anthropic/active',
      platform: 'linux',
    });

    expect(line).toBe(
      'export CLAUDE_CONFIG_DIR="$(readlink -f "/data/subscriptions/anthropic/active")"',
    );
  });

  test('given Windows, the line names the junction, which the file system resolves on its own', () => {
    const line = shellSetupLineFor({
      provider: 'openai',
      pointer: 'C:\\data\\subscriptions\\openai\\active',
      platform: 'win32',
    });

    expect(line).toBe('$env:CODEX_HOME="C:\\data\\subscriptions\\openai\\active"');
  });
});
