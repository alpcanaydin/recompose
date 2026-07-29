import { useSuspenseQuery } from '@tanstack/react-query';

import { FieldGroup, FieldRow, Switch, TextField } from '../../../shared/ui';
import { settingsQueryOptions } from '../api/settings';
import { EnginePortRow } from './engine-port-row';
import { GatewayTokenRow } from './gateway-token-row';
import { TokenRequirementRow } from './token-requirement-row';

const waitingOnEngine = 'Waiting on the engine.';

/** Port, bind address, and the token the gateway demands, in local-network order. */
export function ServerSection() {
  const { data: settings } = useSuspenseQuery(settingsQueryOptions);

  return (
    <FieldGroup heading="Server">
      <EnginePortRow />
      <FieldRow
        control={
          <TextField inert label="Bind address" onChangeValue={() => {}} value="127.0.0.1" />
        }
        description="Chooses the interface the gateway answers on."
        inert
        label="Bind address"
        reason={waitingOnEngine}
      />
      <TokenRequirementRow />
      {settings.requireGatewayToken ? <GatewayTokenRow /> : null}
      <FieldRow
        control={
          <Switch
            checked={false}
            inert
            label="Start gateways on launch"
            onChangeChecked={() => {}}
          />
        }
        description="Starts every gateway as recompose opens."
        inert
        label="Start gateways on launch"
        reason={waitingOnEngine}
      />
    </FieldGroup>
  );
}
