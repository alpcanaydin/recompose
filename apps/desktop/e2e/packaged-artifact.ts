import { findLatestBuild, parseElectronApp } from 'electron-playwright-helpers';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { inflateSync } from 'node:zlib';

const SCAFFOLD_ICON_MD5 = 'a2cf889708d9c4959c6808b4584848e4';
const ICON_EXTENSIONS = new Set(['.png', '.ico', '.icns']);
const ICO_DIRECTORY_HEADER_BYTES = 6;
const ICO_DIRECTORY_ENTRY_BYTES = 16;
const ICO_BITMAP_HEADER_BYTES = 40;
const PNG_SIGNATURE_BYTES = 8;
const PNG_CHUNK_LENGTH_BYTES = 4;
const PNG_CHUNK_TYPE_BYTES = 4;
const PNG_CHUNK_CRC_BYTES = 4;
const PNG_READABLE_BIT_DEPTH = 8;
const PNG_NOT_INTERLACED = 0;
const PNG_SAMPLES_PER_PIXEL = new Map([
  [4, 2],
  [6, 4],
]);

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

type PngChunk = { type: string; body: Buffer };
type PngRasterLayout = { width: number; height: number; samplesPerPixel: number };
type PngNeighbors = { left: number; above: number; aboveLeft: number };
type PngScanline = { filtered: Buffer; previous: Buffer; samplesPerPixel: number };

function pngChunks(bytes: Buffer): readonly PngChunk[] {
  const chunks: PngChunk[] = [];
  let at = PNG_SIGNATURE_BYTES;

  while (at + PNG_CHUNK_LENGTH_BYTES + PNG_CHUNK_TYPE_BYTES <= bytes.length) {
    const length = bytes.readUInt32BE(at);
    const bodyAt = at + PNG_CHUNK_LENGTH_BYTES + PNG_CHUNK_TYPE_BYTES;

    chunks.push({
      type: bytes.toString('ascii', at + PNG_CHUNK_LENGTH_BYTES, bodyAt),
      body: bytes.subarray(bodyAt, bodyAt + length),
    });

    at = bodyAt + length + PNG_CHUNK_CRC_BYTES;
  }

  return chunks;
}

function pngRasterLayout(file: string, chunks: readonly PngChunk[]): PngRasterLayout {
  const header = chunks.find((chunk) => chunk.type === 'IHDR');

  if (header === undefined) {
    throw new Error(`reading the alpha channel of ${file} failed: it declares no PNG header`);
  }

  const depth = header.body.readUInt8(8);
  const colorType = header.body.readUInt8(9);
  const interlace = header.body.readUInt8(12);
  const samplesPerPixel = PNG_SAMPLES_PER_PIXEL.get(colorType);

  if (
    samplesPerPixel === undefined ||
    depth !== PNG_READABLE_BIT_DEPTH ||
    interlace !== PNG_NOT_INTERLACED
  ) {
    throw new Error(
      `reading the alpha channel of ${file} failed: it declares color type ${String(colorType)}, bit depth ${String(depth)}, and interlace ${String(interlace)}, while an alpha channel reads only from an 8 bit non interlaced color type 4 or 6`,
    );
  }

  return {
    width: header.body.readUInt32BE(0),
    height: header.body.readUInt32BE(4),
    samplesPerPixel,
  };
}

function paethPredictor({ left, above, aboveLeft }: PngNeighbors): number {
  const estimate = left + above - aboveLeft;
  const towardLeft = Math.abs(estimate - left);
  const towardAbove = Math.abs(estimate - above);
  const towardAboveLeft = Math.abs(estimate - aboveLeft);

  if (towardLeft <= towardAbove && towardLeft <= towardAboveLeft) {
    return left;
  }

  return towardAbove <= towardAboveLeft ? above : aboveLeft;
}

const PNG_FILTER_CORRECTIONS = new Map<number, (neighbors: PngNeighbors) => number>([
  [0, () => 0],
  [1, ({ left }) => left],
  [2, ({ above }) => above],
  [3, ({ left, above }) => Math.floor((left + above) / 2)],
  [4, paethPredictor],
]);

function filterCorrection(filter: number, neighbors: PngNeighbors): number {
  const correction = PNG_FILTER_CORRECTIONS.get(filter);

  if (correction === undefined) {
    throw new Error(`a scanline declares filter ${String(filter)}, which no PNG filter answers`);
  }

  return correction(neighbors);
}

function unfilteredScanline({ filtered, previous, samplesPerPixel }: PngScanline): Buffer {
  const filter = filtered.readUInt8(0);
  const stride = previous.length;
  const row = Buffer.alloc(stride);

  for (let at = 0; at < stride; at += 1) {
    const carriesLeft = at >= samplesPerPixel;
    const correction = filterCorrection(filter, {
      left: carriesLeft ? row.readUInt8(at - samplesPerPixel) : 0,
      above: previous.readUInt8(at),
      aboveLeft: carriesLeft ? previous.readUInt8(at - samplesPerPixel) : 0,
    });

    row.writeUInt8((filtered.readUInt8(at + 1) + correction) & 0xff, at);
  }

  return row;
}

function unfilteredSamples(
  inflated: Buffer,
  { width, height, samplesPerPixel }: PngRasterLayout,
): Buffer {
  const stride = width * samplesPerPixel;
  const rows: Buffer[] = [];
  let previous: Buffer = Buffer.alloc(stride);

  for (let row = 0; row < height; row += 1) {
    previous = unfilteredScanline({
      filtered: inflated.subarray(row * (stride + 1), (row + 1) * (stride + 1)),
      previous,
      samplesPerPixel,
    });

    rows.push(previous);
  }

  return Buffer.concat(rows);
}

export function fullyTransparentSamplesInPng(file: string): number {
  const chunks = pngChunks(readFileSync(file));
  const layout = pngRasterLayout(file, chunks);
  const compressed = chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.body);
  const samples = unfilteredSamples(inflateSync(Buffer.concat(compressed)), layout);

  return Array.from({ length: layout.width * layout.height }, (_unused, pixel) =>
    samples.readUInt8((pixel + 1) * layout.samplesPerPixel - 1),
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
  const image = distArtifact('.AppImage');
  const into = mkdtempSync(join(tmpdir(), 'recompose-appimage-'));
  const extraction = spawnSync(image, ['--appimage-extract'], { cwd: into, encoding: 'utf8' });

  if (extraction.status !== 0) {
    throw new Error(
      `extracting ${image} into ${into} failed: ${extraction.error?.message ?? extraction.stderr}`,
    );
  }

  return join(into, 'squashfs-root');
}
