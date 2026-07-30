import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodeIcns, type IcnsEntry, volumeIcnsPlan } from './icns-container.mts';
import { encodeIco, type RasterImage } from './ico-container.mts';
import {
  icoPlan,
  linuxLadder,
  sharedRendition,
  silhouetteOf,
  usesSmallGlyph,
  volumeRendition,
} from './icon-geometry.mts';

type RenderedIcon = { rgba: Uint8Array; png: Uint8Array };

const desktopRoot = fileURLToPath(new URL('..', import.meta.url));
const buildDir = join(desktopRoot, 'build');
const resourcesDir = join(desktopRoot, 'resources');

const ICO_FLOOR = 256;
const LADDER_FLOOR = 512;

function readMaster(name: string): string {
  const path = join(buildDir, name);

  try {
    return readFileSync(path, 'utf8');
  } catch (cause) {
    throw new Error(`The icon master ${path} is missing or unreadable`, { cause });
  }
}

function render(svg: string, size: number): RenderedIcon {
  const rendered = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render();

  return { rgba: rendered.pixels, png: rendered.asPng() };
}

function guardFloor(plan: readonly number[], floor: number, name: string): void {
  const top = Math.max(...plan);

  if (top < floor) {
    throw new Error(`The ${name} plan tops out at ${top}, below the ${floor} packaging floor`);
  }
}

function planned(masters: { shared: string; small: string }, points: number): string {
  return usesSmallGlyph(points) ? masters.small : masters.shared;
}

function icoImages(masters: { shared: string; small: string }): readonly RasterImage[] {
  return icoPlan.map((size) => ({ size, rgba: render(planned(masters, size), size).rgba }));
}

function ladderFiles(masters: { shared: string; small: string }): readonly [string, Uint8Array][] {
  return linuxLadder.map((size) => [
    join(buildDir, 'icons', `${size}x${size}.png`),
    render(planned(masters, size), size).png,
  ]);
}

function volumeEntries(volume: string, small: string): readonly IcnsEntry[] {
  return volumeIcnsPlan.map(({ type, points, scale }) => ({
    type,
    png: render(usesSmallGlyph(points) ? small : volume, points * scale).png,
  }));
}

function generate(): readonly [string, Uint8Array][] {
  guardFloor(icoPlan, ICO_FLOOR, 'Windows icon');
  guardFloor(linuxLadder, LADDER_FLOOR, 'Linux ladder');

  const master = readMaster('mark.svg');
  const small = readMaster('mark-small.svg');
  const masters = { shared: sharedRendition(master), small };
  const template = silhouetteOf(small);

  return [
    [join(buildDir, 'icon.ico'), encodeIco(icoImages(masters))],
    ...ladderFiles(masters),
    [join(buildDir, 'volume.icns'), encodeIcns(volumeEntries(volumeRendition(master), small))],
    [join(resourcesDir, 'icon.png'), render(masters.shared, 512).png],
    [join(resourcesDir, 'tray.png'), render(small, 32).png],
    [join(resourcesDir, 'trayTemplate.png'), render(template, 16).png],
    [join(resourcesDir, 'trayTemplate@2x.png'), render(template, 32).png],
  ];
}

const outputs = generate();

for (const [path, bytes] of outputs) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

console.log(`Wrote ${outputs.length} icon files`);
