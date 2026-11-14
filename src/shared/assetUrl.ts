/** The static sample may be hosted below a repository path. */
export function assetUrl(value: string): string {
  return value.startsWith("/") ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "") + value : value;
}
