/** Key used for case-insensitive, whitespace-trimmed uniqueness of titles and names. */
export function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}
