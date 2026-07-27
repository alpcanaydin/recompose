import { dirname, join, resolve } from 'node:path';

function ancestorDirectories(startDirectory: string): readonly string[] {
  const directories = [startDirectory];
  let directory = startDirectory;

  while (dirname(directory) !== directory) {
    directory = dirname(directory);
    directories.push(directory);
  }

  return directories;
}

export function owningCheckoutRoot(
  editedPath: string | undefined,
  fallbackRoot: string,
  markerName: string,
  markerExists: (path: string) => boolean,
): string {
  if (editedPath === undefined) {
    return fallbackRoot;
  }

  return (
    ancestorDirectories(dirname(resolve(fallbackRoot, editedPath))).find((directory) =>
      markerExists(join(directory, markerName)),
    ) ?? fallbackRoot
  );
}
