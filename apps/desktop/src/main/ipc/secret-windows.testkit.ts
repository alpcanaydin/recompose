function windowsOf(value: string, size: number): string[] {
  return Array.from({ length: Math.max(value.length - size + 1, 0) }, (_, start) =>
    value.slice(start, start + size),
  );
}

export function carriesAnyWindowOf(spoken: string, secret: string, size = 8): boolean {
  const spokenWindows = new Set(windowsOf(spoken, size));

  return windowsOf(secret, size).some((window) => spokenWindows.has(window));
}
