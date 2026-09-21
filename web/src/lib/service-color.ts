// Cycles services through the app's existing pastel tint tokens (see
// StatCard's TONE_VARS in globals.css) so a service always renders the same
// color across a session without a color column on the services table.
const TONES = [
  { bg: "--tint-blue-bg", ink: "--tint-blue-ink" },
  { bg: "--tint-green-bg", ink: "--tint-green-ink" },
  { bg: "--tint-amber-bg", ink: "--tint-amber-ink" },
  { bg: "--tint-pink-bg", ink: "--tint-pink-ink" },
];

// Keyed on service name rather than id — every place that needs a color
// (bookings, class sessions) already has the joined name and none carry
// service_id through, and a name collision just means two different
// services share a tone, which is a cosmetic non-issue.
export function colorForService(serviceName: string): { bg: string; ink: string } {
  let hash = 0;
  for (let i = 0; i < serviceName.length; i++) {
    hash = (hash * 31 + serviceName.charCodeAt(i)) >>> 0;
  }
  const tone = TONES[hash % TONES.length];
  return { bg: `var(${tone.bg})`, ink: `var(${tone.ink})` };
}
