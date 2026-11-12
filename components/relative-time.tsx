const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

const format = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });

export function relativeTime(ms: number, now = Date.now()) {
  const diff = ms - now;
  for (const [unit, size] of UNITS) {
    if (Math.abs(diff) >= size) return format.format(Math.round(diff / size), unit);
  }
  return "just now";
}

/** Rendered on the server; the exact UTC time is in the tooltip. */
export function RelativeTime({ ms }: { ms: number }) {
  const date = new Date(ms);
  return (
    <time dateTime={date.toISOString()} title={date.toUTCString()}>
      {relativeTime(ms)}
    </time>
  );
}
