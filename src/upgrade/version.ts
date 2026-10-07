const VERSION_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseVersion(version: string): [number, number, number] {
  const match = VERSION_REGEX.exec(version.trim());
  if (!match) {
    throw new Error(`Versión no válida: "${version}".`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let index = 0; index < 3; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) {
      return diff < 0 ? -1 : 1;
    }
  }
  return 0;
}

/** True when `from < version <= to`. */
export function isVersionInRange(
  version: string,
  from: string,
  to: string,
): boolean {
  return (
    compareVersions(version, from) > 0 && compareVersions(version, to) <= 0
  );
}
