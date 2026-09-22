/*
 * A short, stable identifier for an issue.
 *
 * FNV-1a rather than node:crypto - this module has to run in the browser, and
 * the id only needs to be stable and collision-resistant enough to de-duplicate
 * within one report.
 */

export function createHash (input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
