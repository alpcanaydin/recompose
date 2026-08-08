import { describe, expect, it } from 'vitest';

import type { AnthropicRequest } from './anthropic-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { antigravityProviderRequest } from '../subscription/antigravity-request';
import { translateRequestToGemini } from './gemini-bridge';
import { antigravityWebSearchSystemInstruction } from './gemini-request';

const credential = { accessToken: 'access', projectId: 'project' };

describe('Antigravity Claude native web-search request mapping', () => {
  it('TestConvertClaudeRequestToAntigravity_MapsTypedWebSearchToIndependentSearchRequest', () => {
    const body = providerBody(
      requestOf('gemini-3.1-flash-lite', [webSearchTool(8, ['www.baidu.com', 'weather.com.cn'])]),
    );

    expect(body).toHaveProperty('requestType', 'web_search');
    expect(body).toHaveProperty('request.contents.0.parts.0.text', '北京天气 2026-06-12');
    expect(body).toHaveProperty(
      'request.systemInstruction.parts.0.text',
      antigravityWebSearchSystemInstruction,
    );
    expect(body).toHaveProperty(
      'request.tools.0.googleSearch.enhancedContent.imageSearch.maxResultCount',
      8,
    );
    expect(body).toHaveProperty('request.tools.0.googleSearch.includedDomains', [
      'www.baidu.com',
      'weather.com.cn',
    ]);
    expect(body).toHaveProperty('request.generationConfig.candidateCount', 1);
  });

  it('TestConvertClaudeRequestToAntigravity_UsesDefaultWebSearchMaxResultCountWithoutMaxUses', () => {
    const body = providerBody(requestOf('gemini-3.1-flash-lite', [webSearchTool()]));

    expect(body).toHaveProperty(
      'request.tools.0.googleSearch.enhancedContent.imageSearch.maxResultCount',
      5,
    );
  });

  it('TestConvertClaudeRequestToAntigravity_DoesNotMapTypedWebSearchWhenMixedWithCustomTools', () => {
    const body = providerBody(requestOf('gemini-3.1-flash-lite', [webSearchTool(8), customTool()]));

    expect(body).toHaveProperty('requestType', 'agent');
    expect(JSON.stringify(body)).not.toContain('googleSearch');
    expect(JSON.stringify(body)).toContain('lookup');
  });
});

describe('Antigravity Claude web-search route eligibility', () => {
  it('TestConvertClaudeRequestToAntigravity_DoesNotMapTypedWebSearchForUnsupportedRouteModel', () => {
    const body = providerBody(requestOf('gemini-3.5-flash', [webSearchTool(8)]));

    expect(body).toHaveProperty('model', 'gemini-3.5-flash');
    expect(JSON.stringify(body)).not.toContain('googleSearch');
  });

  it('TestConvertClaudeRequestToAntigravity_DoesNotMapTypedWebSearchForFlashAgentWithoutCapability', () => {
    const body = providerBody(requestOf('gemini-3-flash-agent', [webSearchTool(8)]));

    expect(body).toHaveProperty('model', 'gemini-3-flash-agent');
    expect(JSON.stringify(body)).not.toContain('googleSearch');
  });

  it('TestConvertClaudeRequestToAntigravity_DoesNotMapTypedWebSearchForOtherModels', () => {
    const body = providerBody(requestOf('claude-sonnet-4-6', [webSearchTool(8)]));

    expect(JSON.stringify(body)).not.toContain('googleSearch');
  });
});

function requestOf(model: string, tools: AnthropicRequest['tools']): AnthropicRequest {
  return {
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: '北京天气 2026-06-12' }],
    ...(tools === undefined ? {} : { tools }),
    tool_choice: { type: 'tool', name: 'web_search' },
  };
}

function webSearchTool(
  maxUses?: number,
  domains?: string[],
): NonNullable<AnthropicRequest['tools']>[number] {
  return {
    type: 'web_search_20250305',
    name: 'web_search',
    ...(maxUses === undefined ? {} : { max_uses: maxUses }),
    ...(domains === undefined ? {} : { allowed_domains: domains }),
  };
}

function customTool(): NonNullable<AnthropicRequest['tools']>[number] {
  return {
    name: 'lookup',
    description: 'Lookup local data',
    input_schema: { type: 'object', properties: {} },
  };
}

function providerBody(request: AnthropicRequest): Record<string, unknown> {
  const translated = translateRequestToGemini('anthropic', request);

  if ('refusal' in translated) throw new Error(JSON.stringify(translated.refusal));

  const provider = antigravityProviderRequest(
    'https://daily-cloudcode-pa.googleapis.com',
    { ...translated.value, model: request.model },
    credential,
    { requestId: 'request-1', sessionId: 'session-1' },
    1,
  );
  const parsed = parsedJson(provider.body);

  if (!isJsonObject(parsed)) throw new Error('expected provider body');

  return parsed;
}
