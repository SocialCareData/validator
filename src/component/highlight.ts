/*
 * JSON syntax colouring for the editor.
 *
 * The output is laid behind a transparent <textarea>, so it must reproduce the
 * input character for character: every byte either lands in a token span or is
 * copied through as-is. Anything the pattern does not recognise - a half-typed
 * string, a stray word - is simply left uncoloured, which is the right outcome
 * for a record that is still being written.
 */

const TOKEN = /("(?:[^"\\\n]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g

function escape (text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function span (kind: string, text: string): string {
  return `<span class="tok-${kind}">${escape(text)}</span>`
}

export function highlightJson (text: string): string {
  let out = ''
  let last = 0
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index
    out += escape(text.slice(last, index))
    const [whole, string, colon, number, literal] = match
    if (string !== undefined) {
      if (colon !== undefined) {
        // JSON-LD keywords (@context, @type, @id) are what make a record
        // linked data, so they read differently from ordinary field names.
        out += span(string.startsWith('"@') ? 'keyword' : 'key', string)
        out += escape(colon.slice(0, -1)) + span('punct', ':')
      } else {
        out += span('string', string)
      }
    } else if (number !== undefined) {
      out += span('number', number)
    } else if (literal !== undefined) {
      out += span('literal', literal)
    } else {
      out += span('punct', whole)
    }
    last = index + whole.length
  }
  out += escape(text.slice(last))
  // A <pre> drops a final empty line that a textarea still shows, which would
  // leave the last row of colour one line short of the caret.
  return text.endsWith('\n') || text === '' ? `${out} ` : out
}
