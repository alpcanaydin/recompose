import { describe, it } from 'vitest';

import {
  probeErrorMapping,
  probeFallbackText,
  probeLongToolIds,
  probeParallelCalls,
  probePendingCalls,
  probeReasoningLifecycle,
  probeStopMapping,
  probeWebSearch,
} from './codex-claude-response-parity.testkit';

const rows: readonly [string, () => Promise<void>][] = [
  ['StreamSerializesInterleavedNamedFunctionCalls', probeParallelCalls],
  ['StreamDefersOtherContentUntilFunctionCallsClose', probeParallelCalls],
  ['StreamDeferredTextClosesBeforeThinkingStarts', probeParallelCalls],
  ['StreamTerminalMatchesFunctionCallsByOutputIndex', probeParallelCalls],
  ['StreamTerminalHydratesInterleavedFunctionCalls', probeParallelCalls],
  ['StreamThinkingIncludesSignature', probeReasoningLifecycle],
  ['StreamCyberPolicyError', probeErrorMapping],
  ['StreamErrorTypeFallbackMessage', probeErrorMapping],
  ['StreamThinkingWithoutReasoningItemStillIncludesSignatureField', probeReasoningLifecycle],
  ['StreamThinkingKeepsSingleBlockAcrossSummaryParts', probeReasoningLifecycle],
  ['StreamThinkingEmitsSingleSignatureAcrossMultipartReasoning', probeReasoningLifecycle],
  ['StreamThinkingNeverEmitsPreContentEncryptedContent', probeReasoningLifecycle],
  ['StreamThinkingEmitsOneBlockPerReasoningItem', probeReasoningLifecycle],
  ['StreamThinkingUsesEarlyCapturedSignatureWhenDoneOmitsIt', probeReasoningLifecycle],
  ['StreamThinkingUsesFinalDoneSignature', probeReasoningLifecycle],
  ['StreamSignatureOnlyReasoningEmitsThinkingSignature', probeReasoningLifecycle],
  ['NonStreamThinkingIncludesSignature', probeReasoningLifecycle],
  ['StreamTextBeforeToolCallsDoesNotEmitGhostStop', probeParallelCalls],
  ['StreamFunctionCallDefersStartUntilDoneName', probePendingCalls],
  ['StreamUnnamedFunctionCallDoneByCallIDKeepsPendingSlots', probePendingCalls],
  ['StreamDeferredUnnamedFunctionCallDoesNotReserveBlockIndex', probePendingCalls],
  ['StreamTerminalOutputHydratesOpenFunctionCallArguments', probePendingCalls],
  ['StreamTerminalOutputEmitsPendingUnnamedFunctionCall', probePendingCalls],
  ['StreamUnresolvedPendingFunctionCallDoesNotForceToolUseStopReason', probePendingCalls],
  ['StreamEmptyOutputUsesOutputItemDoneMessageFallback', probeFallbackText],
  ['StreamWebSearchCallEmitsClaudeServerToolBlocks', probeWebSearch],
  ['StreamWebSearchCallReusesFallbackToolUseID', probeWebSearch],
  ['ShortensLongToolUseIDs', probeLongToolIds],
  ['StreamStopReasonMapping', probeStopMapping],
  ['StreamStopSequenceMapping', probeStopMapping],
  ['NonStreamWebSearchCallEmitsServerToolBlocks', probeWebSearch],
  ['NonStreamWebSearchStopReasonEndTurn', probeWebSearch],
  ['NonStreamWebSearchDedupesEmptyOpenPageItems', probeWebSearch],
  ['NonStreamStopReasonMapping', probeStopMapping],
  ['NonStreamStopSequenceMapping', probeStopMapping],
];

describe('Codex to Claude response upstream row parity', () => {
  it.each(rows)('should preserve %s', async (_name, probe) => {
    await probe();
  });
});
