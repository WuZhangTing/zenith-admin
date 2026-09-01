/**
 * Serialize JSON for an inline script / JSON-LD script element.
 *
 * JSON is valid JavaScript, but a literal `</script>` still terminates a raw
 * script element before the browser parses the JSON. Escaping the characters
 * that have meaning in HTML's raw-text state keeps the value valid JSON while
 * preventing script-element breakout. Line/paragraph separators are escaped
 * as well so the result is safe when embedded in ordinary JavaScript.
 */
const SCRIPT_ESCAPE_MAP: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

const SCRIPT_ESCAPE_RE = /[<>&\u2028\u2029]/g;

/**
 * Return a JSON string that can be placed after `dangerouslySetInnerHTML` in
 * an inline script. `undefined` is represented as JSON `null` because an
 * omitted value would otherwise produce the literal text `undefined`.
 */
export function serializeJsonForScript(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return 'null';
  return serialized.replace(SCRIPT_ESCAPE_RE, (character) => SCRIPT_ESCAPE_MAP[character] ?? character);
}
