import { execFileSync } from 'node:child_process';

const allowlist = new Set([
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC-BY-4.0',
  'CC0-1.0',
  'ISC',
  'MIT',
  'MPL-2.0',
  'Python-2.0',
  'Unlicense',
]);

type LicenseAudit = {
  readonly distinctLicenses: number;
  readonly offenders: readonly string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function readVersions(value: unknown): readonly string[] {
  return isList(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function readVersionedPackages(value: unknown): readonly unknown[] {
  return isList(value) ? value : [];
}

function describeOffender(license: string, value: unknown): string {
  if (!isRecord(value)) {
    throw new Error(`pnpm reported a ${license} package that is not an object`);
  }

  const name = value['name'];

  if (typeof name !== 'string') {
    throw new Error(`pnpm reported a ${license} package carrying no name`);
  }

  return `${name}@${readVersions(value['versions']).join(',')} (${license})`;
}

function auditLicenses(report: string): LicenseAudit {
  const parsed: unknown = JSON.parse(report);

  if (!isRecord(parsed)) {
    throw new Error('pnpm licenses list did not report a JSON object');
  }

  const entries = Object.entries(parsed);
  const offenders: string[] = [];

  for (const [license, packages] of entries) {
    if (!allowlist.has(license)) {
      offenders.push(
        ...readVersionedPackages(packages).map((value) => describeOffender(license, value)),
      );
    }
  }

  return { distinctLicenses: entries.length, offenders };
}

const { distinctLicenses, offenders } = auditLicenses(
  execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  }),
);

if (offenders.length > 0) {
  console.error('licenses outside the allowlist:');

  for (const offender of offenders) {
    console.error(`  ${offender}`);
  }

  process.exit(1);
}

console.log(`license gate passed: ${distinctLicenses} distinct licenses, all allowlisted`);
