import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { FieldRow, Switch } from '../../../shared/ui';
import { gatewayTokenQueryOptions, useMintGatewayToken } from '../api/gateway-token';
import { settingsQueryOptions, useSettingsWriter } from '../api/settings';
import { saveStatusFor } from '../lib/save-failure';
import { tokenRequirementNote } from '../lib/token-note';
import { couldNotMint } from '../lib/token-status';

/** The switch that demands a token, and the warning about the store holding it. */
export function TokenRequirementRow() {
  const { data: settings } = useSuspenseQuery(settingsQueryOptions);
  const { data: token } = useSuspenseQuery(gatewayTokenQueryOptions);
  const { save, unsavedFields } = useSettingsWriter();
  const mint = useMintGatewayToken();
  const [refused, setRefused] = useState(false);

  const require = (required: boolean) => {
    if (required && token.storage === 'unavailable') {
      setRefused(true);

      return;
    }

    setRefused(false);
    save({ requireGatewayToken: required });

    if (required && token.masked === null) {
      mint.mutate();
    }
  };

  const mintRefused = settings.requireGatewayToken && mint.isError;
  const note =
    tokenRequirementNote(token.storage, refused) ?? (mintRefused ? couldNotMint : undefined);

  return (
    <FieldRow
      control={
        <Switch
          checked={settings.requireGatewayToken}
          label="Require API token"
          onChangeChecked={require}
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
