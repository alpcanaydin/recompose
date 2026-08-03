import { FieldGroup, FieldRow, Switch } from '../../../../shared/ui';

/** The address every gateway answers on, and the launch behavior they all share. */
export function ServerSection() {
  return (
    <FieldGroup heading="Server">
      <FieldRow
        control={<span className="text-control text-ink-secondary">127.0.0.1 and [::1]</span>}
        description="Fixed at loopback. recompose never serves the network."
        label="Bind address"
      />
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
