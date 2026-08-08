import type { JsonObject } from '../gateway-wire';
import type { SummaryConfig, SummaryFormat, SummaryPolicyOptions } from './summary-policy-types';

import { applySummaryPolicy, type SummaryPolicyResult } from './summary-policy-apply';
import { extractSummaryConfig } from './summary-policy-extract';

export type { SummaryConfig, SummaryFormat, SummaryPolicyOptions, SummaryPolicyResult };
export { applySummaryPolicy, extractSummaryConfig };

export function extractExplicitSummaryConfig(
  body: JsonObject,
  format: SummaryFormat,
): SummaryConfig {
  return extractSummaryConfig(body, format, true);
}

export function applySummaryConfig(
  body: JsonObject,
  format: SummaryFormat,
  config: SummaryConfig,
  options: SummaryPolicyOptions = {},
): SummaryPolicyResult {
  return applySummaryPolicy(body, format, config, options);
}

export function applySummaryFromSource(
  body: JsonObject,
  source: JsonObject,
  sourceFormat: SummaryFormat,
  targetFormat: SummaryFormat,
  options: SummaryPolicyOptions = {},
): SummaryPolicyResult {
  return applySummaryPolicy(
    body,
    targetFormat,
    extractSummaryConfig(source, sourceFormat),
    options,
  );
}
