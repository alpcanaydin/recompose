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
