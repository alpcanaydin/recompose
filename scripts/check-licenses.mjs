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

const raw = execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
const byLicense = JSON.parse(raw);

const offenders = Object.entries(byLicense)
  .filter(([license]) => !allowlist.has(license))
  .flatMap(([license, packages]) =>
    packages.map((pkg) => `${pkg.name}@${pkg.versions.join(',')} (${license})`),
  );

if (offenders.length > 0) {
  console.error('licenses outside the allowlist:');

  for (const offender of offenders) {
    console.error(`  ${offender}`);
  }

  process.exit(1);
}

console.log(
  `license gate passed: ${Object.keys(byLicense).length} distinct licenses, all allowlisted`,
);
