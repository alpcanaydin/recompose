export type ClaudeDeviceProfile = {
  userAgent: string;
  packageVersion: string;
  runtimeVersion: string;
  os: string;
  arch: string;
  timeout: string;
};

export type ClaudeDeviceProfilePolicy = {
  stabilize?: boolean;
  baseline?: Partial<ClaudeDeviceProfile>;
  legacy?: boolean;
};

export const CLAUDE_CODE_220_PROFILE: ClaudeDeviceProfile = {
  userAgent: 'claude-cli/2.1.220 (external, cli)',
  packageVersion: '0.94.0',
  runtimeVersion: 'v26.3.0',
  os: 'MacOS',
  arch: 'arm64',
  timeout: '600',
};

const measuredVersions = new Set(['2.1.60', '2.1.70', '2.1.71', '2.1.220']);

export function claudeDeviceProfileStabilizationEnabled(
  policy: ClaudeDeviceProfilePolicy | undefined,
): boolean {
  return policy?.stabilize === true;
}

export function configuredClaudeProfile(
  policy: ClaudeDeviceProfilePolicy | undefined,
): ClaudeDeviceProfile {
  return { ...CLAUDE_CODE_220_PROFILE, ...policy?.baseline };
}

export class ClaudeDeviceProfileResolver {
  private readonly profiles = new Map<string, ClaudeDeviceProfile>();

  resolve(
    key: string,
    policy: ClaudeDeviceProfilePolicy | undefined,
    incoming?: ClaudeDeviceProfile,
    beforeStore?: (candidate: ClaudeDeviceProfile) => void,
  ): ClaudeDeviceProfile {
    const baseline = configuredClaudeProfile(policy);

    if (!claudeDeviceProfileStabilizationEnabled(policy)) return baseline;

    const candidate = validCandidate(incoming, baseline);
    const cached = this.profiles.get(key);

    if (candidate === null) return cached ?? baseline;

    return this.stabilized(key, candidate, cached ?? baseline, beforeStore);
  }

  private stabilized(
    key: string,
    candidate: ClaudeDeviceProfile,
    fallback: ClaudeDeviceProfile,
    beforeStore: ((candidate: ClaudeDeviceProfile) => void) | undefined,
  ): ClaudeDeviceProfile {
    beforeStore?.(candidate);

    const rechecked = this.profiles.get(key);
    const selected = upgradedProfile(rechecked ?? fallback, candidate);

    this.profiles.set(key, selected);

    return selected;
  }

  store(key: string, profile: ClaudeDeviceProfile): void {
    this.profiles.set(key, profile);
  }

  clear(): void {
    this.profiles.clear();
  }
}

function validCandidate(
  incoming: ClaudeDeviceProfile | undefined,
  baseline: ClaudeDeviceProfile,
): ClaudeDeviceProfile | null {
  if (incoming === undefined || !measuredFingerprint(incoming)) return null;
  if (versionOf(incoming.userAgent) < versionOf(baseline.userAgent)) return null;

  return { ...incoming, os: baseline.os, arch: baseline.arch };
}

function measuredFingerprint(profile: ClaudeDeviceProfile): boolean {
  const version = cliVersion(profile.userAgent);

  return version !== null && measuredVersions.has(version);
}

function cliVersion(userAgent: string): string | null {
  return (
    /^claude-cli\/(\d+\.\d+\.\d+) \(external, (?:cli|sdk-cli)\)$/u.exec(userAgent)?.[1] ?? null
  );
}

function versionOf(userAgent: string): number {
  const version = cliVersion(userAgent);

  if (version === null) return 0;

  const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);

  return major * 1_000_000 + minor * 1_000 + patch;
}

function upgradedProfile(
  current: ClaudeDeviceProfile,
  candidate: ClaudeDeviceProfile,
): ClaudeDeviceProfile {
  if (versionOf(candidate.userAgent) <= versionOf(current.userAgent)) return current;

  return { ...candidate, os: current.os, arch: current.arch };
}

export type ClaudeWirePolicy = { oauth: boolean; confirmedClaudeCode: boolean; cloak: boolean };

export function resolveClaudeWirePolicy(
  credential: string,
  confirmedClaudeCode: boolean,
  mode: 'auto' | 'always' | 'never' = 'auto',
): ClaudeWirePolicy {
  const oauth = credential.startsWith('sk-ant-oat');
  const cloak = oauth && !confirmedClaudeCode && mode !== 'never';

  return { oauth, confirmedClaudeCode, cloak };
}
