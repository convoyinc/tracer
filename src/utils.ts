/**
 * Datadog only supports UInt64 trace ids, this isn't all that far off.
 */
export function pseudoUuid() {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1;
}
