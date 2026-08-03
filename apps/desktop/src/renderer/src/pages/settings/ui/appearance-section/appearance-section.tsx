import { useSuspenseQuery } from '@tanstack/react-query';

import { FieldGroup, FieldRow, SegmentedControl } from '../../../../shared/ui';
import { settingsQueryOptions, useSettingsWriter } from '../../api/settings';
import { themeChoices } from '../../lib/choices';
import { saveStatusFor } from '../../lib/save-failure';

/** The theme recompose paints in, the one appearance it decides. */
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
        status={saveStatusFor('theme', unsavedFields)}
      />
    </FieldGroup>
  );
}
