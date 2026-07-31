export type RootSearch = {
  create?: true;
  getStarted?: true;
  at?: string;
};

function pressMark(at: unknown): string | undefined {
  return typeof at === 'string' || typeof at === 'number' ? String(at) : undefined;
}

function asked(value: unknown): boolean {
  return value === true || value === 'true';
}

/** The surface request a route reads back out of its search, dropping anything it never wrote. */
export function surfaceRequest(search: Record<string, unknown>): RootSearch {
  const request: RootSearch = {};
  const at = pressMark(search['at']);

  if (asked(search['create'])) {
    request.create = true;
  }

  if (asked(search['getStarted'])) {
    request.getStarted = true;
  }

  if (at !== undefined) {
    request.at = at;
  }

  return request;
}

/** Asks the surface for the creation sheet, keeping whatever else the search already carries. */
export function withSheet(previous: RootSearch): RootSearch {
  return { ...previous, create: true };
}

/** Closes the creation sheet, keeping whatever else the search already carries. */
export function withoutSheet(previous: RootSearch): RootSearch {
  const remaining: RootSearch = {};

  if (previous.getStarted === true) {
    remaining.getStarted = true;
  }

  if (previous.at !== undefined) {
    remaining.at = previous.at;
  }

  return remaining;
}
