import { describe, expect, test } from 'vitest';

import { optimizeCodexMultiAgent } from './codex-multi-agent';

const heading = 'Available model overrides (optional; inherited parent model is preferred):';

function spawn(description: string) {
  return {
    type: 'function',
    name: 'spawn_agent',
    description,
    parameters: { properties: { message: { type: 'string', encrypted: true } } },
  };
}

function namespace(name: string, tools: readonly unknown[]) {
  return { type: 'namespace', name, tools };
}

function body(description = 'Spawns an agent.') {
  return { model: 'gpt-5.4', tools: [namespace('collaboration', [spawn(description)])] };
}

describe('Codex multi-agent client policy parity', () => {
  test('TestRewriteCodexSpawnAgentDescriptionDisabledLeavesPayloadUnchanged', () => {
    const payload = body('unchanged');

    expect(optimizeCodexMultiAgent(payload, { enabled: false })).toBe(payload);
  });

  test('TestRewriteCodexSpawnAgentDescriptionIgnoresOtherUserAgent', () => {
    const payload = body('unchanged');

    expect(optimizeCodexMultiAgent(payload, { userAgent: 'curl/8.7.1' })).toBe(payload);
  });

  test('TestOptimizeCodexMultiAgentV2RequestSkipsNamespaceConflict', () => {
    const payload = {
      model: 'gpt-5.4',
      tools: [
        namespace('collaboration', [spawn('Spawns an agent.')]),
        namespace('collaboration-optimize', []),
      ],
    };
    const optimized = optimizeCodexMultiAgent(payload);

    expect(optimized).toHaveProperty('tools.0.name', 'collaboration');
    expect(optimized).not.toHaveProperty('tools.0.tools.0.parameters.properties.message.encrypted');
  });

  test('TestOptimizeCodexCollaborationNamespaceWithoutModels', () => {
    const optimized = optimizeCodexMultiAgent(body(), { models: [] });

    expect(optimized).toHaveProperty('tools.0.name', 'collaboration');
    expect(optimized).not.toHaveProperty('tools.0.tools.0.parameters.properties.message.encrypted');
  });
});

describe('Codex spawn-agent description parity', () => {
  test('TestRewriteCodexSpawnAgentDescriptionTopLevelWithoutMarker', () => {
    const optimized = optimizeCodexMultiAgent({
      model: 'gpt-5.4',
      tools: [spawn('Delegate work.')],
    });

    expect(optimized).toHaveProperty(
      'tools.0.description',
      expect.stringContaining(`${heading}\n- \`gpt-5.4\``),
    );
  });

  test('TestReplaceCodexSpawnAgentModelsNormalizesSectionsAndPreservesInstructions', () => {
    const description = `${heading}\n- \`old-model\`: old\nKeep this multi-agent instruction.\nSpawns an agent.\n${heading}`;
    const optimized = optimizeCodexMultiAgent(body(description));
    const rewritten = JSON.stringify(optimized);

    expect(rewritten).not.toContain('old-model');
    expect(rewritten.split(heading)).toHaveLength(2);
    expect(rewritten).toContain('Keep this multi-agent instruction.');
  });

  test('TestCodexSpawnAgentModelsFromSourcesIncludesModelMetadata', () => {
    const optimized = optimizeCodexMultiAgent(body(), {
      models: [
        {
          id: 'custom-model',
          description: 'Dynamic model',
          reasoningEfforts: ['none', 'low', 'medium', 'high'],
          defaultReasoningEffort: 'medium',
          serviceTiers: ['priority'],
        },
      ],
    });

    expect(optimized).toHaveProperty(
      'tools.0.tools.0.description',
      expect.stringContaining(
        '- `custom-model`: Dynamic model. Reasoning efforts: none, low, medium (default), high. Service tiers: priority.',
      ),
    );
  });
});
