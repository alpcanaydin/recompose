import { dirname, join, resolve } from 'node:path';

export type ConfigurationSearch = {
  readonly configurationName: string;
  readonly configurationExists: (path: string) => boolean;
  readonly reachableDirectories: (start: string) => readonly string[];
};

export function configurationRoot(
  editedPath: string | undefined,
  fallbackRoot: string,
  search: ConfigurationSearch,
): string {
  if (editedPath === undefined) {
    return fallbackRoot;
  }

  const start = dirname(resolve(fallbackRoot, editedPath));
  const owner = search
    .reachableDirectories(start)
    .find((directory) => search.configurationExists(join(directory, search.configurationName)));

  return owner ?? fallbackRoot;
}
