import { describe, expect, it } from 'vitest';

import type { HubAudioBlock } from './hub';

import { responsesPartFromHubBlock } from './responses-media-encode';

describe('responsesPartFromHubBlock names the audio format a user turn carries', () => {
  it('takes the subtype of a media type that names one', () => {
    const part = responsesPartFromHubBlock('user', audio('audio/wav'));

    expect(part).toEqual({
      type: 'input_audio',
      input_audio: { data: 'QUJD', format: 'wav' },
    });
  });

  it('keeps a bare format that names no media type at all', () => {
    const part = responsesPartFromHubBlock('user', audio('wav'));

    expect(part).toEqual({
      type: 'input_audio',
      input_audio: { data: 'QUJD', format: 'wav' },
    });
  });

  it('shortens the mpeg media type to the format the wire expects', () => {
    const part = responsesPartFromHubBlock('user', audio('audio/mpeg'));

    expect(part).toEqual({
      type: 'input_audio',
      input_audio: { data: 'QUJD', format: 'mp3' },
    });
  });
});

// Helpers

function audio(mediaType: string): HubAudioBlock {
  return { type: 'audio', source: { type: 'base64', mediaType, data: 'QUJD' } };
}
