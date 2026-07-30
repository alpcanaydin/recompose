import { brandPalette } from './brand-palette.mts';

export type FlattenedStop =
  | 'darkBandTop'
  | 'darkBandBottom'
  | 'outerBandTop'
  | 'outerBandBottom'
  | 'noteTop'
  | 'noteBottom';

type ColorChannels = readonly [number, number, number];

const HEX_TRIPLET = /^#[0-9a-f]{6}$/i;

const MARK_STOP_OPACITY = 0.8;
const NOTE_SPAN_TOP = 46 / 256;
const NOTE_SPAN_BOTTOM = 210 / 256;
const FLUENT_RADIUS_ON_48 = 2;
const FLUENT_GRID = 48;
const SMALL_GLYPH_CUTOFF_POINTS = 32;

export const darkBandInsetFraction = 12 / 256;
export const tileInsetFraction = 24 / 256;

export const icoPlan: readonly number[] = Object.freeze([16, 24, 32, 48, 256]);
export const linuxLadder: readonly number[] = Object.freeze([
  16, 24, 32, 48, 64, 96, 128, 256, 512,
]);

export function concentricRadius(outerRadius: number, inset: number): number {
  return Math.max(outerRadius - inset, 0);
}

export function fluentOuterRadius(size: number): number {
  return (size * FLUENT_RADIUS_ON_48) / FLUENT_GRID;
}

export function usesSmallGlyph(points: number): boolean {
  return points < SMALL_GLYPH_CUTOFF_POINTS;
}

export const markCanvas = 1024;

const VOLUME_TILE_EDGE = 824;
const VOLUME_MARGIN = 100;
const VOLUME_OUTER_RADIUS = 186;
const VOLUME_SCALE = VOLUME_TILE_EDGE / markCanvas;

const FRAME_RECTANGLES = [
  '<rect width="1024" height="1024"',
  '<rect x="48" y="48" width="928" height="928"',
  '<rect x="96" y="96" width="832" height="832"',
] as const;

function roundedTo(value: number): number {
  return Number(value.toFixed(4));
}

function withFrameRadii(master: string, radii: readonly number[]): string {
  return FRAME_RECTANGLES.reduce((svg, opening, index) => {
    if (!svg.includes(opening)) {
      throw new Error(`The master is missing the frame rectangle "${opening}"`);
    }

    return svg.replace(opening, `${opening} rx="${roundedTo(radii[index] ?? 0)}"`);
  }, master);
}

export function sharedRendition(master: string): string {
  const outer = fluentOuterRadius(markCanvas);

  return withFrameRadii(master, [
    outer,
    concentricRadius(outer, markCanvas * darkBandInsetFraction),
    concentricRadius(outer, markCanvas * tileInsetFraction),
  ]);
}

export function volumeRendition(master: string): string {
  const outer = VOLUME_OUTER_RADIUS / VOLUME_SCALE;
  const inset = withFrameRadii(master, [
    outer,
    concentricRadius(outer, markCanvas * darkBandInsetFraction),
    concentricRadius(outer, markCanvas * tileInsetFraction),
  ]);

  return [
    `<svg width="${markCanvas}" height="${markCanvas}" viewBox="0 0 ${markCanvas} ${markCanvas}" fill="none" xmlns="http://www.w3.org/2000/svg">`,
    `<g transform="translate(${VOLUME_MARGIN} ${VOLUME_MARGIN}) scale(${VOLUME_SCALE})">`,
    inset,
    '</g>',
    '</svg>',
  ].join('\n');
}

export function silhouetteOf(smallMaster: string): string {
  return smallMaster
    .replaceAll(brandPalette.noteCream, '#000000')
    .replaceAll(brandPalette.frameTop, '#000000');
}

function channelsOf(color: string): ColorChannels {
  if (!HEX_TRIPLET.test(color)) {
    throw new Error(`Expected a six digit hex color, received "${color}"`);
  }

  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ];
}

function colorOf(channels: ColorChannels): string {
  const digits = channels
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0').toUpperCase())
    .join('');

  return `#${digits}`;
}

function mixChannels(
  front: ColorChannels,
  back: ColorChannels,
  frontWeight: number,
): ColorChannels {
  const backWeight = 1 - frontWeight;

  return [
    front[0] * frontWeight + back[0] * backWeight,
    front[1] * frontWeight + back[1] * backWeight,
    front[2] * frontWeight + back[2] * backWeight,
  ];
}

export function flattenOver(foreground: string, backdrop: string, alpha: number): string {
  return colorOf(mixChannels(channelsOf(foreground), channelsOf(backdrop), alpha));
}

export function tileSampleAt(position: number): string {
  const top = channelsOf(brandPalette.tileTop);
  const bottom = channelsOf(brandPalette.tileBottom);

  return colorOf(mixChannels(bottom, top, position));
}

const darkBandTop = flattenOver(brandPalette.frameTop, brandPalette.tileTop, MARK_STOP_OPACITY);
const darkBandBottom = flattenOver(
  brandPalette.frameBottom,
  brandPalette.tileBottom,
  MARK_STOP_OPACITY,
);

export const flattenedMarkFills: Readonly<Record<FlattenedStop, string>> = Object.freeze({
  darkBandTop,
  darkBandBottom,
  outerBandTop: flattenOver(brandPalette.brandWhite, darkBandTop, MARK_STOP_OPACITY),
  outerBandBottom: flattenOver(brandPalette.bandFade, darkBandBottom, MARK_STOP_OPACITY),
  noteTop: flattenOver(brandPalette.noteCream, tileSampleAt(NOTE_SPAN_TOP), MARK_STOP_OPACITY),
  noteBottom: flattenOver(
    brandPalette.brandWhite,
    tileSampleAt(NOTE_SPAN_BOTTOM),
    MARK_STOP_OPACITY,
  ),
});
