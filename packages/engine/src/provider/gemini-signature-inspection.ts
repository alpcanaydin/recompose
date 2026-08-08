import { strictCaisClaudeSignature } from '../subscription/claude-signature-structure';
import { canonicalBase64, signatureVarint } from './signature-wire';

export const GEMINI_SKIP_THOUGHT_SIGNATURE_VALIDATOR = 'skip_thought_signature_validator';
export const GEMINI_CONTEXT_ENGINEERING_BYPASS = 'context_engineering_is_the_way_to_go';
const MAX_GEMINI_THOUGHT_SIGNATURE_LENGTH = 32 * 1024 * 1024;

type GeminiSignatureEnvelope = 'unknown' | 'protobuf_field_2' | 'ascii_uuid';
export type GeminiSignatureInspectionOptions = {
  allowBypassSentinel?: boolean;
  requireKnownEnvelope?: boolean;
  requireObservedMarker?: boolean;
};
export type GeminiSignatureInfo = {
  bypassSentinel?: string;
  decodedLength: number;
  envelope: GeminiSignatureEnvelope;
  firstByte?: number;
  hasObservedMarker: boolean;
  isBypassSentinel: boolean;
  knownEnvelope: boolean;
  opaquePayloadLength: number;
  recordCount: number;
};

const ASCII_UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu;

function bypass(value: string): boolean {
  return [GEMINI_SKIP_THOUGHT_SIGNATURE_VALIDATOR, GEMINI_CONTEXT_ENGINEERING_BYPASS].includes(
    value,
  );
}

function decodedBase64(value: string): Buffer | null {
  return canonicalBase64(value, {
    allowUnpadded: true,
    maxLength: MAX_GEMINI_THOUGHT_SIGNATURE_LENGTH,
  });
}

function lengthDelimited(bytes: Buffer, offset: number): Buffer | null {
  const length = signatureVarint(bytes, offset, 5);

  if (length === null) return null;

  const end = length.end + length.value;

  return end === bytes.length ? bytes.subarray(length.end, end) : null;
}

function fieldTwoPayload(decoded: Buffer): Buffer | null {
  if (decoded[0] !== 0x12) return null;

  const outer = lengthDelimited(decoded, 1);

  return outer?.[0] === 0x0a ? lengthDelimited(outer, 1) : null;
}

function nativePayload(payload: Buffer | null): payload is Buffer {
  if (payload === null) return false;
  if (payload[0] === 0x01) return true;

  return ASCII_UUID.test(payload.toString());
}

function envelopeInfo(
  decoded: Buffer,
): Pick<GeminiSignatureInfo, 'envelope' | 'knownEnvelope' | 'opaquePayloadLength' | 'recordCount'> {
  if (ASCII_UUID.test(decoded.toString())) {
    return {
      envelope: 'ascii_uuid',
      knownEnvelope: false,
      opaquePayloadLength: decoded.length,
      recordCount: 0,
    };
  }

  const payload = fieldTwoPayload(decoded);

  return nativePayload(payload)
    ? {
        envelope: 'protobuf_field_2',
        knownEnvelope: true,
        opaquePayloadLength: payload.length,
        recordCount: 1,
      }
    : {
        envelope: 'unknown',
        knownEnvelope: false,
        opaquePayloadLength: decoded.length,
        recordCount: 0,
      };
}

function bypassInfo(value: string): GeminiSignatureInfo {
  return {
    bypassSentinel: value,
    decodedLength: 0,
    envelope: 'unknown',
    hasObservedMarker: false,
    isBypassSentinel: true,
    knownEnvelope: false,
    opaquePayloadLength: 0,
    recordCount: 0,
  };
}

function claudeCais(value: string): boolean {
  const separator = value.indexOf('#');
  const unprefixed = separator < 0 ? value : value.slice(separator + 1).trim();

  return strictCaisClaudeSignature(unprefixed)?.startsWith('C') === true;
}

function signatureValue(signature: unknown): string | null {
  if (typeof signature !== 'string') return null;

  const value = signature.trim();

  return value === '' || claudeCais(value) ? null : value;
}

function decodedInfo(value: string): GeminiSignatureInfo | null {
  const decoded = decodedBase64(value);

  if (decoded === null || decoded.length === 0) return null;

  const firstByte = decoded[0];

  if (firstByte === undefined) return null;

  return {
    decodedLength: decoded.length,
    ...envelopeInfo(decoded),
    firstByte,
    hasObservedMarker: firstByte === 0x12,
    isBypassSentinel: false,
  };
}

function acceptsOptions(
  info: GeminiSignatureInfo,
  options: GeminiSignatureInspectionOptions,
): boolean {
  if (options.requireKnownEnvelope === true && !info.knownEnvelope) return false;
  if (options.requireObservedMarker === true && !info.hasObservedMarker) return false;

  return true;
}

function inspectedValue(
  value: string,
  options: GeminiSignatureInspectionOptions,
): GeminiSignatureInfo | null {
  if (bypass(value)) return bypassValue(value, options.allowBypassSentinel === true);

  const info = decodedInfo(value);

  return info !== null && acceptsOptions(info, options) ? info : null;
}

function bypassValue(value: string, allowed: boolean): GeminiSignatureInfo | null {
  return allowed ? bypassInfo(value) : null;
}

export function inspectGeminiThoughtSignature(
  signature: unknown,
  options: GeminiSignatureInspectionOptions = {},
): GeminiSignatureInfo | null {
  const value = signatureValue(signature);

  if (value === null) return null;

  return inspectedValue(value, options);
}
