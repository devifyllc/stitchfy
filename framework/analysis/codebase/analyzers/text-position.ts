/** Shared line-from-offset helper — used by the Maven XML parser and the Java source analyzer. */

export function buildLineIndex(text: string): number[] {
  const offsets = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") offsets.push(i + 1);
  return offsets;
}

export function lineForOffset(lineIndex: number[], offset: number): number {
  let lo = 0;
  let hi = lineIndex.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineIndex[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}
