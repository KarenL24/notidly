/** Next.js App Router: `searchParams` values may be string or string[]. */
export function searchParamFirst(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const v = sp[key]
  if (v === undefined) return undefined
  if (Array.isArray(v)) return v[0]
  return v
}
