// SQLite's datetime('now') stores timestamps as "YYYY-MM-DD HH:MM:SS" in
// UTC, with no timezone marker at all. That format isn't real ISO-8601, and
// browsers disagree on how to read it — several (Chrome included, in
// certain builds) parse it as the *visitor's local time* instead of UTC.
// For a visitor in India (UTC+5:30), that silently shifts every "just
// placed" order into looking ~5.5 hours old — exactly the Kitchen Display
// bug this fixes. Converting to real ISO-8601 with an explicit "Z" removes
// all ambiguity: every browser reads it as UTC, which is what it actually is.
export function parseDbDate(str) {
  if (!str) return new Date(NaN);
  if (str instanceof Date) return str;
  // Already has a timezone marker (Z or +hh:mm) — don't touch it.
  if (/[zZ]|[+-]\d\d:\d\d$/.test(str)) return new Date(str);
  // Plain date-only strings ("YYYY-MM-DD", e.g. billing_cycle_start) are
  // already unambiguous ISO-8601 and every browser correctly parses them
  // as UTC midnight — appending "Z" to these would actually break them
  // (there's no time component for it to attach to).
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str);
  return new Date(str.replace(" ", "T") + "Z");
}
