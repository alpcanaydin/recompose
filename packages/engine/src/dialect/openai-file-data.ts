export type NormalizedFileData = { mediaType: string; data: string };

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
};

export function normalizeOpenAIFileData(
  filename: string,
  fallbackMediaType: string | undefined,
  fileData: string,
): NormalizedFileData | null {
  if (fileData === '') return null;

  if (/^data:/iu.test(fileData)) return dataUrlParts(fileData);

  const mediaType = fallbackMediaType ?? mediaTypeFromFilename(filename);

  return mediaType === undefined ? null : { mediaType, data: fileData };
}

function dataUrlParts(fileData: string): NormalizedFileData | null {
  const matched = /^data:([^,]*),(.*)$/isu.exec(fileData);

  if (matched?.[1] === undefined || matched[2] === undefined || matched[2] === '') return null;

  return normalizedDataUrl(matched[1], matched[2]);
}

function normalizedDataUrl(metadata: string, data: string): NormalizedFileData | null {
  const fields = metadata.split(';').map((field) => field.trim());
  const mediaType = fields.shift();

  if (mediaType === undefined || mediaType === '') return null;

  return fields.some((field) => field.toLowerCase() === 'base64') ? { mediaType, data } : null;
}

function mediaTypeFromFilename(filename: string): string | undefined {
  const extension = /\.([^.]+)$/u.exec(filename)?.[1]?.toLowerCase();

  return extension === undefined ? undefined : MIME_BY_EXTENSION[extension];
}
