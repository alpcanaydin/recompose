import { useSuspenseQuery } from '@tanstack/react-query';

import { FieldGroup, FieldRow, SegmentedControl } from '../../../../shared/ui';
import { systemQueryOptions, useOpenConfigFolder } from '../../api/system';
import { logRetentionChoices } from '../../lib/choices';
import { revealLabelFor } from '../../lib/row-state';
import { RowAction } from '../row-action/row-action';

/** Where recompose keeps its data, and how long the engine will keep request logs. */
export function DataSection() {
  const { data: system } = useSuspenseQuery(systemQueryOptions);
  const openConfigFolder = useOpenConfigFolder();

  return (
    <FieldGroup heading="Data">
      <FieldRow
        control={
          <RowAction
            onClick={() => {
              openConfigFolder.mutate();
            }}
          >
            {revealLabelFor(system.fileBrowser)}
          </RowAction>
        }
        description={system.configFolder}
        label="Config folder"
        status={openConfigFolder.isError ? openConfigFolder.error.message : undefined}
      />
      <FieldRow
        control={
          <SegmentedControl
            inert
            label="Keep request logs"
            onChangeValue={() => {}}
            options={logRetentionChoices}
            value="30"
          />
        }
        description="Drops request logs older than the window you choose."
        inert
        label="Keep request logs"
        reason="Waits on request logging."
      />
    </FieldGroup>
  );
}
