import { useSuspenseQuery } from '@tanstack/react-query';

import { FieldGroup, FieldRow, SegmentedControl, Switch } from '../../../shared/ui';
import { settingsQueryOptions, useSettingsWriter } from '../api/settings';
import { themeChoices } from '../lib/choices';
import { saveStatusFor } from '../lib/save-failure';

/** Theme choice, and the wire motion the canvas will answer to. */
export function AppearanceSection() {
  const { data: settings } = useSuspenseQuery(settingsQueryOptions);
  const { save, unsavedFields } = useSettingsWriter();

  return (
    <FieldGroup heading="Appearance">
      <FieldRow
        control={
          <SegmentedControl
            label="Theme"
            onChangeValue={(theme) => {
              save({ theme });
            }}
            options={themeChoices}
            value={settings.theme}
          />
        }
        description="Follows the system appearance unless you pick one."
        label="Theme"
        {...saveStatusFor('theme', unsavedFields)}
      />
      <FieldRow
        control={
          <Switch checked={false} inert label="Reduce wire motion" onChangeChecked={() => {}} />
        }
        description="Stills the wires that animate between nodes."
        inert
        label="Reduce wire motion"
        reason="Waiting on the canvas."
      />
    </FieldGroup>
  );
}
