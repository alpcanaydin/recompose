import { panelWidth } from '../../../shared/lib';

/** How wide the inspector stands, which the stage and the drawer both read the same way. */
export function inspectorWidth(): number {
  return panelWidth('inspector');
}
