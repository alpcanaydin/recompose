import preview from '#.storybook/preview';

import { GhostGraph } from './ghost-graph';

const meta = preview.meta({
  component: GhostGraph,
});

/** The outline of the gateway a person has not made yet. */
export const Basic = meta.story({});
