/** Keeps the `?state=` preview override while moving between pages. */
export function withState(path: string, state?: string) {
  return state ? `${path}?state=${encodeURIComponent(state)}` : path;
}
