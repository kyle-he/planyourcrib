/** Short, collision-resistant ids. Readable prefixes make debugging plans easier. */
export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}
