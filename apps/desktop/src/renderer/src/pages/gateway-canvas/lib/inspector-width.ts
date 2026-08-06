import { panelWidth } from '../../../shared/lib';

const INSPECTOR_STANDING_WIDTH = 304;

/** How wide the inspector stands, which is the last width a person dragged it to. */
export function inspectorWidth(): number {
  return panelWidth('inspector', INSPECTOR_STANDING_WIDTH);
}
