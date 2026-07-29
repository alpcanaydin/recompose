import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { FieldRow } from '../../../shared/ui';
import {
  gatewayTokenQueryOptions,
  useCopyGatewayToken,
  useMintGatewayToken,
} from '../api/gateway-token';
import { couldNotRead, tokenRowStatus } from '../lib/token-status';
import { TokenActions } from './token-actions';
import { TokenConfirmation } from './token-confirmation';

const nothingMintedYet = 'Nothing has been minted yet.';

function UnreadableTokenRow({ reason }: { reason: string }) {
  return (
    <FieldRow
      control={<span />}
      description={couldNotRead}
      inert
      label="API token"
      status={reason}
    />
  );
}

type TokenControlProps = {
  masked: string | null;
  confirming: boolean;
  onCopy: () => void;
  onMintNow: () => void;
  onStartConfirming: () => void;
  onStopConfirming: () => void;
};

function TokenControl({
  masked,
  confirming,
  onCopy,
  onMintNow,
  onStartConfirming,
  onStopConfirming,
}: TokenControlProps) {
  return (
    <div
      className="flex items-center gap-2"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onStopConfirming();
        }
      }}
    >
      {confirming ? (
        <TokenConfirmation onCancel={onStopConfirming} onConfirm={onMintNow} />
      ) : (
        <TokenActions
          masked={masked}
          onCopy={onCopy}
          onMint={() => {
            if (masked === null) {
              onMintNow();

              return;
            }

            onStartConfirming();
          }}
        />
      )}
    </div>
  );
}

/** The masked gateway credential, its copy action, and the confirmation guarding a new one. */
export function GatewayTokenRow() {
  const { data: answered } = useSuspenseQuery(gatewayTokenQueryOptions);
  const copy = useCopyGatewayToken();
  const mint = useMintGatewayToken();
  const [confirming, setConfirming] = useState(false);

  if (!answered.ok) {
    return <UnreadableTokenRow reason={answered.error.message} />;
  }

  const gateway = answered.value;

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
        <TokenControl
          confirming={confirming}
          masked={gateway.masked}
          onCopy={() => {
            copy.mutate();
          }}
          onMintNow={mintNow}
          onStartConfirming={() => {
            setConfirming(true);
          }}
          onStopConfirming={stopConfirming}
        />
      }
      description={gateway.masked ?? nothingMintedYet}
      label="API token"
      {...tokenRowStatus({
        confirming,
        copied: copy.isSuccess,
        copyFailed: copy.isError,
        mintFailed: mint.isError,
      })}
    />
  );
}
