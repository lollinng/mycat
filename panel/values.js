// What a field copies. A field can work its value out instead of storing it:
// { compute: { daysUntil: "2030-03-01" } } copies the days left until that date (0 once it has passed).
export function valueOf(field, today = new Date()) {
  const until = field.compute?.daysUntil;
  if (until) {
    const [y, m, d] = until.split('-').map(Number);
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return String(Math.max(0, Math.round((new Date(y, m - 1, d) - start) / 86400000)));
  }
  return field.value ?? '';
}

// Every word of the query appears somewhere in the text, in any order, any case.
export function matches(text, query) {
  const hay = text.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

export function titleOf(text) {
  return text.split('\n').find((l) => l.trim())?.trim() || 'Empty note';
}

export function ago(iso, now = new Date()) {
  const s = (now - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
