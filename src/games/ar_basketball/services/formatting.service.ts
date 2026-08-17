// Pure and transport/DB-agnostic on purpose: no imports, trivially
// unit-testable in isolation.

// Keeps the first 4 and last 3 characters, replacing everything between
// with a literal "***" - matches the spec's own example (0712345678 ->
// 0712***678) exactly, rather than a percentage-based mask that would
// produce a different shape for other lengths. Input too short for both
// anchors to exist without overlapping is masked entirely instead, so
// nothing meaningful ever leaks.
export const maskPhone = (phone: string): string => {
  if (phone.length <= 7) {
    return "*".repeat(phone.length);
  }
  const start = phone.slice(0, 4);
  const end = phone.slice(-3);
  return `${start}***${end}`;
};
