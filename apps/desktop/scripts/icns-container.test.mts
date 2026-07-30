import { describe, expect, it } from 'vitest';

import { encodeIcns, type IcnsEntry, volumeIcnsPlan } from './icns-container.mts';

const ENTRY_HEADER_BYTES = 8;

function fakePng(marker: number, length: number): Uint8Array {
  return new Uint8Array(length).fill(marker);
}

function readEntries(container: Buffer): readonly { type: string; payload: Buffer }[] {
  const entries: { type: string; payload: Buffer }[] = [];
  let at = ENTRY_HEADER_BYTES;

  while (at < container.byteLength) {
    const type = container.toString('ascii', at, at + 4);
    const declared = container.readUInt32BE(at + 4);

    entries.push({ type, payload: container.subarray(at + ENTRY_HEADER_BYTES, at + declared) });
    at += declared;
  }

  return entries;
}

describe('the Apple icon container', () => {
  const entries: readonly IcnsEntry[] = [
    { type: 'icp4', png: fakePng(0x01, 12) },
    { type: 'ic09', png: fakePng(0x02, 30) },
  ];
  const container = encodeIcns(entries);

  it('opens with the magic the format is named for', () => {
    expect(container.toString('ascii', 0, 4)).toBe('icns');
  });

  it('declares its own total length, so a reader can trust the file end', () => {
    expect(container.readUInt32BE(4)).toBe(container.byteLength);
  });

  it('returns every payload under the type it went in as', () => {
    expect(readEntries(container)).toEqual([
      { type: 'icp4', payload: Buffer.from(fakePng(0x01, 12)) },
      { type: 'ic09', payload: Buffer.from(fakePng(0x02, 30)) },
    ]);
  });

  it('counts the entry header inside each declared length', () => {
    expect(container.readUInt32BE(ENTRY_HEADER_BYTES + 4)).toBe(12 + ENTRY_HEADER_BYTES);
  });

  it('refuses a type that is not the four characters the format allows', () => {
    expect(() => encodeIcns([{ type: 'ic9', png: fakePng(0x03, 4) }])).toThrow('ic9');
  });
});

describe('the volume icon plan', () => {
  it('steps through the ten legacy grid entries the disk image reads', () => {
    expect(volumeIcnsPlan.map((entry) => entry.type)).toEqual([
      'icp4',
      'icp5',
      'ic11',
      'ic12',
      'ic07',
      'ic13',
      'ic08',
      'ic14',
      'ic09',
      'ic10',
    ]);
  });

  it('pairs each entry with the point size and scale it renders at', () => {
    expect(volumeIcnsPlan.map((entry) => [entry.points, entry.scale])).toEqual([
      [16, 1],
      [32, 1],
      [16, 2],
      [32, 2],
      [128, 1],
      [128, 2],
      [256, 1],
      [256, 2],
      [512, 1],
      [512, 2],
    ]);
  });

  it('tops out at a 1024 pixel payload, clearing the 512 floor packaging enforces', () => {
    const pixelSizes = volumeIcnsPlan.map((entry) => entry.points * entry.scale);

    expect(Math.max(...pixelSizes)).toBe(1024);
  });
});
