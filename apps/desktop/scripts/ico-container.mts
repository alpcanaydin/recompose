export type RasterImage = { size: number; rgba: Uint8Array; png: Uint8Array };

const DIRECTORY_HEADER_BYTES = 6;
const DIRECTORY_ENTRY_BYTES = 16;
const BITMAP_HEADER_BYTES = 40;
const PNG_ENTRY_SIZE = 256;
const OPAQUE = 255;

function straightFromPremultiplied(channel: number, alpha: number): number {
  return alpha === 0 ? 0 : Math.min(Math.round((channel * OPAQUE) / alpha), OPAQUE);
}

function writeStraightBgra(target: Buffer, to: number, source: Buffer, at: number): void {
  const alpha = source.readUInt8(at + 3);

  target.writeUInt8(straightFromPremultiplied(source.readUInt8(at + 2), alpha), to);
  target.writeUInt8(straightFromPremultiplied(source.readUInt8(at + 1), alpha), to + 1);
  target.writeUInt8(straightFromPremultiplied(source.readUInt8(at), alpha), to + 2);
  target.writeUInt8(alpha, to + 3);
}

function bottomUpBgra(source: Buffer, size: number): Buffer {
  const rowBytes = size * 4;
  const pixels = Buffer.alloc(size * rowBytes);

  for (let row = 0; row < size; row += 1) {
    const from = (size - 1 - row) * rowBytes;

    for (let column = 0; column < size; column += 1) {
      writeStraightBgra(pixels, row * rowBytes + column * 4, source, from + column * 4);
    }
  }

  return pixels;
}

function transparencyMask(source: Buffer, size: number): Buffer {
  const rowBytes = Math.ceil(size / 32) * 4;
  const mask = Buffer.alloc(rowBytes * size);

  for (let row = 0; row < size; row += 1) {
    const from = (size - 1 - row) * size * 4;

    for (let column = 0; column < size; column += 1) {
      if (source.readUInt8(from + column * 4 + 3) === 0) {
        const at = row * rowBytes + (column >> 3);

        mask.writeUInt8(mask.readUInt8(at) | (0x80 >> (column & 7)), at);
      }
    }
  }

  return mask;
}

function encodeBitmap({ size, rgba }: RasterImage): Buffer {
  const header = Buffer.alloc(BITMAP_HEADER_BYTES);

  header.writeUInt32LE(BITMAP_HEADER_BYTES, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(size * size * 4, 20);

  const source = Buffer.from(rgba);

  return Buffer.concat([header, bottomUpBgra(source, size), transparencyMask(source, size)]);
}

function payloadFor(image: RasterImage): Buffer {
  const expectedBytes = image.size * image.size * 4;

  if (image.rgba.byteLength !== expectedBytes) {
    throw new Error(
      `Icon entry at ${image.size} needs ${expectedBytes} bytes of pixels, received ${image.rgba.byteLength}`,
    );
  }

  return image.size >= PNG_ENTRY_SIZE ? Buffer.from(image.png) : encodeBitmap(image);
}

export function encodeIco(images: readonly RasterImage[]): Buffer {
  const entries = images.map((image) => ({ image, payload: payloadFor(image) }));
  const directory = Buffer.alloc(DIRECTORY_HEADER_BYTES + entries.length * DIRECTORY_ENTRY_BYTES);

  directory.writeUInt16LE(0, 0);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(entries.length, 4);

  let offset = directory.byteLength;

  entries.forEach(({ image, payload }, index) => {
    const at = DIRECTORY_HEADER_BYTES + index * DIRECTORY_ENTRY_BYTES;

    directory.writeUInt8(image.size % PNG_ENTRY_SIZE, at);
    directory.writeUInt8(image.size % PNG_ENTRY_SIZE, at + 1);
    directory.writeUInt16LE(1, at + 4);
    directory.writeUInt16LE(32, at + 6);
    directory.writeUInt32LE(payload.byteLength, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += payload.byteLength;
  });

  return Buffer.concat([directory, ...entries.map(({ payload }) => payload)]);
}
