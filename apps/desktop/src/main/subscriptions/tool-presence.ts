import {
  subscriptionProviderIdSchema,
  subscriptionProviders,
  type SubscriptionProviderId,
  type SubscriptionTool,
} from '@recompose/contracts';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { join } from 'node:path';

import type { SubscriptionHomes } from './subscription-homes';

import { shellSetupLineFor, signInCommandFor } from './subscription-commands';

const windowsShimSuffixes = ['.cmd', '.exe', '.bat'];

export type ToolReportRequest = {
  homes: SubscriptionHomes;
  searchPath: string;
  platform: NodeJS.Platform;
};

function candidateNames(binary: string, platform: NodeJS.Platform): string[] {
  return platform === 'win32'
    ? windowsShimSuffixes.map((suffix) => `${binary}${suffix}`)
    : [binary];
}

async function runnable(candidate: string, platform: NodeJS.Platform): Promise<boolean> {
  const demand = platform === 'win32' ? constants.F_OK : constants.X_OK;

  return access(candidate, demand).then(
    () => true,
    () => false,
  );
}

async function resolvesOnSearchPath(
  binary: string,
  searchPath: string,
  platform: NodeJS.Platform,
): Promise<boolean> {
  const folders = searchPath.split(platform === 'win32' ? ';' : ':').filter((one) => one !== '');
  const names = candidateNames(binary, platform);

  for (const folder of folders) {
    for (const name of names) {
      if (await runnable(join(folder, name), platform)) {
        return true;
      }
    }
  }

  return false;
}

async function reportTool(
  provider: SubscriptionProviderId,
  request: ToolReportRequest,
): Promise<SubscriptionTool> {
  const { toolBinary, toolName } = subscriptionProviders[provider];

  return {
    provider,
    toolName,
    present: await resolvesOnSearchPath(toolBinary, request.searchPath, request.platform),
    signInCommand: signInCommandFor({
      provider,
      home: request.homes.pendingHomeFor(provider),
      platform: request.platform,
    }),
    shellSetupLine: shellSetupLineFor({
      provider,
      pointer: request.homes.activePointerFor(provider),
      platform: request.platform,
    }),
  };
}

export async function reportTools(request: ToolReportRequest): Promise<SubscriptionTool[]> {
  return Promise.all(
    subscriptionProviderIdSchema.options.map(async (provider) => reportTool(provider, request)),
  );
}
