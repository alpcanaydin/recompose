import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { FieldRow } from '../../../shared/ui';
import {
  gatewayTokenQueryOptions,
  useCopyGatewayToken,
  useMintGatewayToken,
} from '../api/gateway-token';
import { TokenActions } from './token-actions';
import { TokenConfirmation } from './token-confirmation';

const consequence = 'Clients holding the old token stop connecting.';
const nothingMintedYet = 'Nothing has been minted yet.';

function statusFor(confirming: boolean, copied: boolean, failed: boolean): { status?: string } {
  if (confirming) {
    return { status: consequence };
  }

  if (failed) {
    return { status: 'The value could not be minted.' };
  }

  return copied ? { status: 'Copied.' } : {};
}

/** The masked gateway credential, its copy action, and the confirmation guarding a new one. */
export function GatewayTokenRow() {
  const { data: gateway } = useSuspenseQuery(gatewayTokenQueryOptions);
  const copy = useCopyGatewayToken();
  const mint = useMintGatewayToken();
  const [confirming, setConfirming] = useState(false);

  const stopConfirming = () => {
    setConfirming(false);
  };

  const mintNow = () => {
    stopConfirming();
    mint.mutate();
  };

  return (
    <FieldRow
      control={
        <div
          className="flex items-center gap-2"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              stopConfirming();
            }
          }}
        >
          {confirming ? (
            <TokenConfirmation onCancel={stopConfirming} onConfirm={mintNow} />
          ) : (
            <TokenActions
              masked={gateway.masked}
              onCopy={() => {
                copy.mutate();
              }}
              onMint={() => {
                if (gateway.masked === null) {
                  mintNow();

                  return;
                }

                setConfirming(true);
              }}
            />
          )}
        </div>
      }
      description={gateway.masked ?? nothingMintedYet}
      label="API token"
      {...statusFor(confirming, copy.isSuccess, mint.isError)}
    />
  );
}
