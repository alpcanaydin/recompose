const separators = ['/', '\\'];

function withoutTrailingSeparator(home: string): string {
  return separators.includes(home.slice(-1)) ? home.slice(0, -1) : home;
}

function startsAWholeFolder(rest: string): boolean {
  return rest === '' || separators.includes(rest.slice(0, 1));
}

/**
 * The folder as a person reads it, with their home directory written as the shorthand.
 *
 * @summary Shorten before the path crosses the bridge, so no account name reaches the screen, and
 * read the home directory the process actually has rather than guessing it from the shape.
 */
export function homeRelative(folder: string, home: string): string {
  const root = withoutTrailingSeparator(home);
  const rest = folder.slice(root.length);

  if (!folder.startsWith(root) || !startsAWholeFolder(rest)) {
    return folder;
  }

  return `~${rest}`;
}
