import { useSuspenseQuery } from '@tanstack/react-query';

import { FieldGroup, FieldRow, Switch } from '../../../shared/ui';
import { useSettingsWriter } from '../api/settings';
import { systemQueryOptions } from '../api/system';
import { launchAtLoginRow } from '../lib/row-state';
import { saveStatusFor } from '../lib/save-failure';

/** Launch at login, menu bar presence, and the telemetry recompose never sends. */
export function GeneralSection() {
  const { data: system } = useSuspenseQuery(systemQueryOptions);
  const { save, unsavedFields } = useSettingsWriter();

  const { rendered, ...waiting } = launchAtLoginRow(system.loginItem);

  return (
    <FieldGroup heading="General">
      {rendered ? (
        <FieldRow
          control={
            <Switch
              checked={system.loginItemEnabled}
              inert={waiting.inert}
              label="Launch at login"
              onChangeChecked={(enabled) => {
                save({ launchAtLogin: enabled });
              }}
            />
          }
          description="Opens recompose when you sign in."
          label="Launch at login"
          {...{ ...waiting, ...saveStatusFor('launchAtLogin', unsavedFields) }}
        />
      ) : null}
      <FieldRow
        control={
          <Switch
            checked={system.menuBarVisible}
            label="Show in menu bar"
            onChangeChecked={(visible) => {
              save({ showInMenuBar: visible });
            }}
          />
        }
        description="Keeps recompose running after the last window closes."
        label="Show in menu bar"
        {...saveStatusFor('showInMenuBar', unsavedFields)}
      />
      <FieldRow
        control={<span className="text-control text-ink-secondary">None</span>}
        description="recompose never phones home."
        label="Telemetry"
      />
    </FieldGroup>
  );
}
