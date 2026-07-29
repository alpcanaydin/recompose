const homePrefixes = [
  /^\/Users\/[^/]+(?=\/|$)/,
  /^\/home\/[^/]+(?=\/|$)/,
  /^[A-Za-z]:\\Users\\[^\\]+(?=\\|$)/,
];

/**
 * The folder as a person reads it, with their home directory written as the shorthand.
 *
 * @summary Reach for it before showing a path on screen, so no one reads their own account name back.
 */
export function homeRelative(folder: string): string {
  for (const prefix of homePrefixes) {
    const match = prefix.exec(folder);

    if (match !== null) {
      return `~${folder.slice(match[0].length)}`;
    }
  }

  return folder;
}
