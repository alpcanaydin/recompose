/**
 * The two shapes a control in the window strip takes.
 *
 * @summary `standing` is a control that sits alone in the strip, raised on its own surface, and
 * `grouped` is one inside a button group, where the group carries the surface instead. Every
 * control in the strip reads from here, so a size or a radius that changes once changes for all.
 */
export const toolbarShape = {
  grouped: 'h-5.75 w-7.75 rounded-chip',
  standing: 'h-7.25 w-8.5 rounded-control border border-line-subtle bg-surface-raised',
} as const;
