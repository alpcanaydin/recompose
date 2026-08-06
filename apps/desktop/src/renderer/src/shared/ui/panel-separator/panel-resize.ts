export type PanelBounds = {
  /** The narrowest the panel may stand without collapsing. */
  min: number;
  /** The widest the panel may stand. */
  max: number;
  /** How far under the narrowest width a drag has to go before the panel closes instead. */
  collapseBelow: number;
  /** How far one arrow key moves the separator. */
  step: number;
};

/**
 * How wide each panel may stand, and how far a drag has to go to shut it.
 *
 * @summary The narrowest widths are the ones the panels' own content still reads at: the sidebar
 * at its shipped width, the inspector where its endpoint row still holds one line. The collapse
 * slack is what keeps a person who overshoots the minimum by a few pixels from losing the panel.
 */
export const panelBounds = {
  sidebar: { min: 200, max: 360, collapseBelow: 48, step: 16 },
  inspector: { min: 260, max: 480, collapseBelow: 48, step: 16 },
} as const satisfies Record<string, PanelBounds>;

/** Where a panel stands once a drag asked for this width: sized to it, or shut. */
export type PanelStanding = { standing: 'sized'; width: number } | { standing: 'collapsed' };

/**
 * What a drag asking for this width does to the panel.
 *
 * @summary A drag inside the bounds sizes the panel, and one that overshoots holds at the bound
 * rather than fighting the pointer. Dragging well under the narrowest width shuts the panel, which
 * is the gesture a person already knows from the sidebar, so the panel closes rather than becoming
 * a sliver nobody can read or grab.
 */
export function draggedPanel(asked: number, bounds: PanelBounds): PanelStanding {
  if (asked <= bounds.min - bounds.collapseBelow) {
    return { standing: 'collapsed' };
  }

  return { standing: 'sized', width: Math.min(Math.max(asked, bounds.min), bounds.max) };
}

/** The width one arrow key away, which never leaves the bounds. */
export function steppedPanel(width: number, direction: number, bounds: PanelBounds): number {
  return Math.min(Math.max(width + direction * bounds.step, bounds.min), bounds.max);
}
