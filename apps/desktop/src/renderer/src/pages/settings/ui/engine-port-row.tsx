import { ENGINE_PORT_RANGE } from '@recompose/contracts';
import { useSuspenseQuery } from '@tanstack/react-query';

import { FieldRow, NumericField } from '../../../shared/ui';
import { settingsQueryOptions, useSettingsWriter } from '../api/settings';
import { saveStatusFor } from '../lib/save-failure';

const acceptedRange = `Accepts ${ENGINE_PORT_RANGE.min} through ${ENGINE_PORT_RANGE.max}.`;

/** The port the gateway listens on, held as a draft until blur or Enter means it. */
export function EnginePortRow() {
  const { data: settings } = useSuspenseQuery(settingsQueryOptions);
  const { save, unsavedFields } = useSettingsWriter();

  return (
    <FieldRow
      control={
        <NumericField
          label="Port"
          max={ENGINE_PORT_RANGE.max}
          min={ENGINE_PORT_RANGE.min}
          onCommitValue={(enginePort) => {
            save({ enginePort });
          }}
          value={settings.enginePort}
        />
      }
      description={acceptedRange}
      label="Port"
      {...saveStatusFor('enginePort', unsavedFields)}
    />
  );
}
