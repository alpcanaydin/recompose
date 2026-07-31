export type IcnsEntry = { type: string; png: Uint8Array };

const ENTRY_HEADER_BYTES = 8;
const TYPE_BYTES = 4;

export const volumeIcnsPlan: readonly { type: string; points: number; scale: 1 | 2 }[] =
  Object.freeze([
    { type: 'icp4', points: 16, scale: 1 },
    { type: 'icp5', points: 32, scale: 1 },
    { type: 'ic11', points: 16, scale: 2 },
    { type: 'ic12', points: 32, scale: 2 },
    { type: 'ic07', points: 128, scale: 1 },
    { type: 'ic13', points: 128, scale: 2 },
    { type: 'ic08', points: 256, scale: 1 },
    { type: 'ic14', points: 256, scale: 2 },
    { type: 'ic09', points: 512, scale: 1 },
    { type: 'ic10', points: 512, scale: 2 },
  ] as const);

function encodeEntry({ type, png }: IcnsEntry): Buffer {
  if (type.length !== TYPE_BYTES) {
    throw new Error(`Icon entry type must be four characters, received "${type}"`);
  }

  const header = Buffer.alloc(ENTRY_HEADER_BYTES);

  header.write(type, 0, TYPE_BYTES, 'ascii');
  header.writeUInt32BE(ENTRY_HEADER_BYTES + png.byteLength, 4);

  return Buffer.concat([header, Buffer.from(png)]);
}

export function encodeIcns(entries: readonly IcnsEntry[]): Buffer {
  const encoded = entries.map(encodeEntry);
  const totalBytes = ENTRY_HEADER_BYTES + encoded.reduce((sum, entry) => sum + entry.byteLength, 0);

  const header = Buffer.alloc(ENTRY_HEADER_BYTES);

  header.write('icns', 0, TYPE_BYTES, 'ascii');
  header.writeUInt32BE(totalBytes, 4);

  return Buffer.concat([header, ...encoded]);
}
