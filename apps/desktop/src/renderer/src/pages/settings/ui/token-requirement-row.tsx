import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { FieldRow, Switch } from '../../../shared/ui';
import { gatewayTokenQueryOptions, useMintGatewayToken } from '../api/gateway-token';
import { settingsQueryOptions, useSettingsWriter } from '../api/settings';
import { saveStatusFor } from '../lib/save-failure';
import {
  tokenOrNothing,
  tokenRequirementDecision,
  tokenRequirementReason,
} from '../lib/token-note';

/** The switch that demands a token, and the warning about the store holding it. */
export function TokenRequirementRow() {
  const { data: settings } = useSuspenseQuery(settingsQueryOptions);
  const { data: answered } = useSuspenseQuery(gatewayTokenQueryOptions);
  const { save, unsavedFields } = useSettingsWriter();
  const mint = useMintGatewayToken();
  const [refused, setRefused] = useState(false);

  const token = tokenOrNothing(answered);

  const demand = (required: boolean) => {
    const decision = tokenRequirementDecision(token, required);

    setRefused(decision === 'refuse');

    if (decision === 'refuse') {
      return;
    }

    save({ requireGatewayToken: required });

    if (decision === 'save-and-mint') {
      mint.mutate();
    }
  };

  const note = tokenRequirementReason({
    token,
    refused,
    mintRefused: settings.requireGatewayToken && mint.isError,
  });

  return (
    <FieldRow
      control={
        <Switch
          checked={settings.requireGatewayToken}
          inert={token === null}
          label="Require API token"
          onChangeChecked={demand}
        />
      }
      description="Turns away gateway requests that carry no token."
      label="Require API token"
      {...(note === undefined
        ? saveStatusFor('requireGatewayToken', unsavedFields)
        : { status: note })}
    />
  );
}
