/*
 * Where a JSON Pointer lands in the original text.
 *
 * Skolemization tells us which *node* a SHACL result is about; the result also
 * names a property, and it is the property the user needs to look at. Without
 * this, a complaint about `address[0].postcode` underlines the whole address
 * object, and a complaint about a root-level field underlines line 1 - both
 * technically true and practically useless.
 */

import { parseTree, findNodeAtLocation, type Node as JsoncNode } from 'jsonc-parser'

export interface SourceSpan {
  offset: number
  length: number
  line: number
  column: number
  endLine: number
  endColumn: number
}

function decodeSegment (segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~')
}

export class SourceMap {
  private readonly tree: JsoncNode | undefined
  private readonly lineStarts: number[]

  constructor (text: string) {
    this.tree = parseTree(text)
    this.lineStarts = [0]
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) this.lineStarts.push(i + 1)
    }
  }

  private lineCol (offset: number): { line: number, column: number } {
    let lo = 0
    let hi = this.lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (this.lineStarts[mid]! <= offset) lo = mid
      else hi = mid - 1
    }
    return { line: lo + 1, column: offset - this.lineStarts[lo]! + 1 }
  }

  /** Locate by pre-split path segments (what the walker already has). */
  locateSegments (segments: (string | number)[]): SourceSpan | undefined {
    if (!this.tree) return undefined
    const node = findNodeAtLocation(this.tree, segments)
    if (!node) return undefined
    const start = this.lineCol(node.offset)
    const end = this.lineCol(node.offset + node.length)
    return {
      offset: node.offset,
      length: node.length,
      line: start.line,
      column: start.column,
      endLine: end.line,
      endColumn: end.column,
    }
  }

  /** Locate by RFC 6901 pointer, e.g. `/address/0/postcode`. */
  locate (pointer: string): SourceSpan | undefined {
    if (pointer === '') return this.locateSegments([])
    const segments = pointer.split('/').slice(1).map((raw) => {
      const decoded = decodeSegment(raw)
      return /^\d+$/.test(decoded) ? Number(decoded) : decoded
    })
    return this.locateSegments(segments)
  }
}
