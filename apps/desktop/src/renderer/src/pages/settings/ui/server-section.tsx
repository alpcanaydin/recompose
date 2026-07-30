import { useSuspenseQuery } from '@tanstack/react-query';

import { FieldGroup, FieldRow, Switch } from '../../../shared/ui';
import { settingsQueryOptions } from '../api/settings';
import { GatewayTokenRow } from './gateway-token-row';
import { TokenRequirementRow } from './token-requirement-row';

/** The address every gateway answers on, and the token the gateway demands. */
export function ServerSection() {
  const { data: settings } = useSuspenseQuery(settingsQueryOptions);

  return (
    <FieldGroup heading="Server">
      <FieldRow
        control={<span className="text-control text-ink-secondary">127.0.0.1</span>}
        description="Fixed at loopback. recompose never serves the network."
        label="Bind address"
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
        reason="Waits on launch-time start."
      />
    </FieldGroup>
  );
}
