import { findLatestBuild, parseElectronApp } from 'electron-playwright-helpers';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';

const SCAFFOLD_ICON_MD5 = 'a2cf889708d9c4959c6808b4584848e4';
const ICON_EXTENSIONS = new Set(['.png', '.ico', '.icns']);
const ICO_DIRECTORY_HEADER_BYTES = 6;
const ICO_DIRECTORY_ENTRY_BYTES = 16;
const ICO_BITMAP_HEADER_BYTES = 40;

export const ICO_PNG_ENTRY_SIZE = 256;
export const appDir = join(__dirname, '..');
export const buildDir = join(appDir, 'build');

const distDir = join(appDir, 'dist');

export type IcoEntry = { size: number; payload: Buffer };

export function iconFilesUnder(root: string): readonly string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && ICON_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .map((entry) => join(entry.parentPath, entry.name));
}

export function scaffoldIconsUnder(root: string): readonly string[] {
  return iconFilesUnder(root).filter(
    (file) => createHash('md5').update(readFileSync(file)).digest('hex') === SCAFFOLD_ICON_MD5,
  );
}

export function latestBuildDir(): string {
  return findLatestBuild(distDir);
}

export function packagedExecutable(): string {
  return parseElectronApp(latestBuildDir()).executable;
}

export function packagedBundle(): string {
  return dirname(dirname(dirname(packagedExecutable())));
}

export function bundlePlistValue(bundle: string, key: string): string {
  const plist = readFileSync(join(bundle, 'Contents', 'Info.plist'), 'utf8');
  const declared = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(plist);

  if (declared?.[1] === undefined) {
    throw new Error(`Info.plist declares no string value for ${key}`);
  }

  return declared[1];
}

export function icoEntries(file: string): readonly IcoEntry[] {
  const bytes = readFileSync(file);

  return Array.from({ length: bytes.readUInt16LE(4) }, (_unused, index) => {
    const at = ICO_DIRECTORY_HEADER_BYTES + index * ICO_DIRECTORY_ENTRY_BYTES;
    const declared = bytes.readUInt8(at);
    const offset = bytes.readUInt32LE(at + 12);

    return {
      size: declared === 0 ? ICO_PNG_ENTRY_SIZE : declared,
      payload: bytes.subarray(offset, offset + bytes.readUInt32LE(at + 8)),
    };
  });
}

export function entryAtSize(entries: readonly IcoEntry[], size: number): IcoEntry {
  const entry = entries.find((candidate) => candidate.size === size);

  if (entry === undefined) {
    throw new Error(`the icon ladder carries no ${String(size)} pixel entry`);
  }

  return entry;
}

export function fullyTransparentSamples({ size, payload }: IcoEntry): number {
  const pixels = payload.subarray(ICO_BITMAP_HEADER_BYTES);

  return Array.from({ length: size * size }, (_unused, sample) =>
    pixels.readUInt8(sample * 4 + 3),
  ).filter((alpha) => alpha === 0).length;
}

function desktopEntries(file: string): Map<string, string> {
  return new Map(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => line.includes('='))
      .map((line) => {
        const at = line.indexOf('=');

        return [line.slice(0, at).trim(), line.slice(at + 1).trim()] as const;
      }),
  );
}

function distArtifact(extension: string): string {
  const match = readdirSync(distDir).find((name) => name.endsWith(extension));

  if (match === undefined) {
    throw new Error(`no ${extension} artifact was packaged into ${distDir}`);
  }

  return join(distDir, match);
}

let debRoot: string | null = null;

export function extractedDeb(): string {
  if (debRoot === null) {
    debRoot = mkdtempSync(join(tmpdir(), 'recompose-deb-'));
    execFileSync('dpkg-deb', ['-x', distArtifact('.deb'), debRoot]);
  }

  return debRoot;
}

export function hicolorRung(size: number): string {
  const rung = `${String(size)}x${String(size)}`;

  return join(extractedDeb(), 'usr/share/icons/hicolor', rung, 'apps', 'recompose.png');
}

export function debDesktopEntry(): Map<string, string> {
  return desktopEntries(join(extractedDeb(), 'usr/share/applications', 'recompose.desktop'));
}

export function extractedAppImage(): string {
  const into = mkdtempSync(join(tmpdir(), 'recompose-appimage-'));

  execFileSync(distArtifact('.AppImage'), ['--appimage-extract'], { cwd: into, stdio: 'ignore' });

  return join(into, 'squashfs-root');
}
