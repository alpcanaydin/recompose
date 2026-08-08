import { describe, expect, it, vi } from 'vitest';

import type { ClaudeDeviceProfile } from './claude-device-profile';

import { claudeBillingFingerprint } from './claude-cch';
import {
  CLAUDE_CODE_220_PROFILE,
  claudeDeviceProfileStabilizationEnabled,
  ClaudeDeviceProfileResolver,
  configuredClaudeProfile,
  resolveClaudeWirePolicy,
} from './claude-device-profile';
import { claudeProviderRequest } from './claude-request';
import { parseSubscriptionCredential } from './credentials';
import { readyClaudeIdentity } from './ready-claude-identity';

describe('Claude credential device migration parity', () => {
  it('TestClaudeExecutorPrepareRequestAuthMigratesFiveDevicesToOne', async () => {
    const devices = ['0', '1', '2', '3', '4'].map((digit) => digit.repeat(64));
    const blob = JSON.stringify({
      account_uuid: 'account',
      claude_device_ids: devices,
      claudeAiOauth: { accessToken: 'token' },
    });
    const credential = parseSubscriptionCredential('anthropic', blob);
    const persist = vi.fn(async () => Promise.resolve());

    if (credential === null) throw new Error('expected credential');

    const ready = await readyClaudeIdentity(
      { provider: 'anthropic', accountId: 'account' },
      { blob, credential },
      {
        persist,
        newClaudeDeviceId: () => 'f'.repeat(64),
        fetchClaudeProfile: async () => Promise.reject(new Error('unexpected profile lookup')),
      },
    );

    expect(ready.credential.deviceIds).toEqual([devices[0]]);
    expect(persist).toHaveBeenCalledOnce();
  });
});

describe('Claude concurrent credential identity parity', () => {
  it('TestEnsureDeviceIDPoolConcurrentInitialization', async () => {
    const blob = JSON.stringify({ claudeAiOauth: { accessToken: 'concurrent-token' } });
    const credential = parseSubscriptionCredential('anthropic', blob);
    const persist = vi.fn(async () => {
      await Promise.resolve();
    });
    const newClaudeDeviceId = vi.fn(() => 'a'.repeat(64));
    const fetchClaudeProfile = vi.fn(async () => {
      await Promise.resolve();

      return { account: { uuid: 'account-uuid' } };
    });

    if (credential === null) throw new Error('expected credential');

    const calls = Array.from({ length: 20 }, async () =>
      readyClaudeIdentity(
        { provider: 'anthropic', accountId: 'concurrent-account' },
        { blob, credential },
        { persist, newClaudeDeviceId, fetchClaudeProfile },
      ),
    );
    const results = await Promise.all(calls);
    const rechecked = await readyClaudeIdentity(
      { provider: 'anthropic', accountId: 'concurrent-account' },
      { blob, credential },
      { persist, newClaudeDeviceId, fetchClaudeProfile },
    );

    expect(results.map(({ credential: ready }) => ready.deviceIds)).toEqual(
      Array.from({ length: 20 }, () => ['a'.repeat(64)]),
    );
    expect(rechecked.credential.deviceIds).toEqual(['a'.repeat(64)]);
    expect(fetchClaudeProfile).toHaveBeenCalledOnce();
    expect(newClaudeDeviceId).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledOnce();
  });
});

describe('Claude adaptive device profile parity', () => {
  it('TestClaudeDeviceProfileStabilizationEnabled_DefaultFalse', () => {
    expect(claudeDeviceProfileStabilizationEnabled(undefined)).toBe(false);
    expect(claudeDeviceProfileStabilizationEnabled({})).toBe(false);
  });

  it('TestApplyClaudeHeaders_UsesConfiguredBaselineFingerprint', () => {
    expect(configuredClaudeProfile({ baseline: baseline() })).toEqual(baseline());
  });

  it('TestApplyClaudeHeaders_RejectsUnmeasuredClaudeCLIFingerprints', () => {
    const resolver = new ClaudeDeviceProfileResolver();

    expect(resolver.resolve('key', stablePolicy(), profile('2.1.62'))).toEqual(baseline());
  });

  it('TestApplyClaudeHeaders_DoesNotDowngradeConfiguredBaselineOnFirstClaudeClient', () => {
    const resolver = new ClaudeDeviceProfileResolver();

    expect(resolver.resolve('key', stablePolicy(), profile('2.1.60')).userAgent).toContain(
      '2.1.70',
    );
  });
});

describe('Claude adaptive profile upgrades and platform pinning parity', () => {
  it('TestApplyClaudeHeaders_UpgradesCachedSoftwareFingerprintWhenBaselineAdvances', () => {
    const resolver = new ClaudeDeviceProfileResolver();

    resolver.resolve('key', stablePolicy(), profile('2.1.70'));
    expect(resolver.resolve('key', stablePolicy(), profile('2.1.71'))).toMatchObject({
      userAgent: 'claude-cli/2.1.71 (external, cli)',
      os: 'MacOS',
      arch: 'arm64',
    });
  });

  it('TestApplyClaudeHeaders_LearnsOfficialFingerprintAfterCustomBaselineFallback', () => {
    const resolver = new ClaudeDeviceProfileResolver();
    const policy = { stabilize: true, baseline: { ...baseline(), userAgent: 'custom/1.0' } };

    expect(resolver.resolve('key', policy).userAgent).toBe('custom/1.0');
    expect(resolver.resolve('key', policy, CLAUDE_CODE_220_PROFILE).userAgent).toContain('2.1.220');
    expect(resolver.resolve('key', policy).userAgent).toContain('2.1.220');
  });

  it('TestResolveClaudeDeviceProfile_RechecksCacheBeforeStoringCandidate', () => {
    const resolver = new ClaudeDeviceProfileResolver();
    const result = resolver.resolve('key', stablePolicy(), profile('2.1.70'), () => {
      resolver.store('key', profile('2.1.71'));
    });

    expect(result.userAgent).toContain('2.1.71');
  });

  it('TestApplyClaudeHeaders_ThirdPartyBaselineThenOfficialUpgradeKeepsPinnedPlatform', () => {
    const resolver = new ClaudeDeviceProfileResolver();
    const incoming = { ...CLAUDE_CODE_220_PROFILE, os: 'Windows', arch: 'x64' };

    expect(resolver.resolve('key', stablePolicy(), incoming)).toMatchObject({
      os: 'MacOS',
      arch: 'arm64',
    });
  });
});

describe('Claude profile stabilization and legacy platform parity', () => {
  it('TestApplyClaudeHeaders_DisableDeviceProfileStabilization', () => {
    const resolver = new ClaudeDeviceProfileResolver();

    expect(
      resolver.resolve('key', { stabilize: false, baseline: baseline() }, CLAUDE_CODE_220_PROFILE),
    ).toEqual(baseline());
  });

  it('TestApplyClaudeHeaders_LegacyModePreservesConfiguredUserAgentOverrideForClaudeClients', () => {
    expect(configuredClaudeProfile({ legacy: true, baseline: baseline() }).userAgent).toContain(
      '2.1.70',
    );
  });

  it('TestApplyClaudeHeaders_LegacyThirdPartyUsesStableConfiguredOSArch', () => {
    expect(configuredClaudeProfile({ legacy: true, baseline: baseline() })).toMatchObject({
      os: 'MacOS',
      arch: 'arm64',
    });
  });

  it('TestApplyClaudeHeaders_UnsetStabilizationUsesStableConfiguredOSArch', () => {
    expect(configuredClaudeProfile({ baseline: { os: 'Linux', arch: 'x64' } })).toMatchObject({
      os: 'Linux',
      arch: 'x64',
    });
  });
});

describe('Claude wire policy and request fingerprint parity', () => {
  it('TestApplyClaudeHeaders_UsesOAuthAuthorizationAndBrowserFingerprint', () => {
    const request = requestWithProfile(CLAUDE_CODE_220_PROFILE);
    const headers = new Map(request.headers);

    expect(headers.get('Authorization')).toBe('Bearer sk-ant-oat-token');
    expect(headers.get('anthropic-dangerous-direct-browser-access')).toBe('true');
    expect(headers.get('User-Agent')).toBe(CLAUDE_CODE_220_PROFILE.userAgent);
  });

  it('TestClaudeExecutor_NonClaudeRequestUsesClaudeCode220CLIFingerprint', () => {
    const headers = new Map(requestWithProfile(undefined).headers);

    expect(headers.get('User-Agent')).toBe('claude-cli/2.1.220 (external, cli)');
    expect(headers.get('X-Stainless-Package-Version')).toBe('0.94.0');
  });

  it('TestClaudeBillingFingerprintUsesLatestUserText', () => {
    expect(
      claudeBillingFingerprint({
        system: 'ignore',
        messages: [
          { role: 'user', content: 'old' },
          { role: 'assistant', content: 'answer' },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'reminder' },
              { type: 'text', text: 'CPA_OFFICIAL_BASEURL_CLI_SYSTEM_EMPTY_b82d4e' },
            ],
          },
        ],
      }),
    ).toBe('e06');
  });

  it('TestResolveClaudeWirePolicy', () => {
    expect(resolveClaudeWirePolicy('sk-ant-oat-token', false, 'auto')).toEqual({
      oauth: true,
      confirmedClaudeCode: false,
      cloak: true,
    });
    expect(resolveClaudeWirePolicy('sk-ant-oat-token', true, 'always').cloak).toBe(false);
    expect(resolveClaudeWirePolicy('sk-ant-oat-token', false, 'never').cloak).toBe(false);
  });
});

function baseline(): ClaudeDeviceProfile {
  return {
    userAgent: 'claude-cli/2.1.70 (external, cli)',
    packageVersion: '0.80.0',
    runtimeVersion: 'v24.5.0',
    os: 'MacOS',
    arch: 'arm64',
    timeout: '900',
  };
}

function stablePolicy() {
  return { stabilize: true, baseline: baseline() };
}

function profile(version: string): ClaudeDeviceProfile {
  return { ...baseline(), userAgent: `claude-cli/${version} (external, cli)` };
}

function requestWithProfile(profileValue: ClaudeDeviceProfile | undefined) {
  return claudeProviderRequest(
    'https://api.anthropic.com',
    { model: 'claude-opus-5', messages: [{ role: 'user', content: 'hello' }] },
    'sk-ant-oat-token',
    { sessionId: 'session', requestId: 'request' },
    undefined,
    Date.UTC(2026, 7, 7),
    'messages',
    undefined,
    undefined,
    undefined,
    profileValue,
  );
}
