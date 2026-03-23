/** API uses ALL CAPS; UI reads better in title case */
export function formatSentimentLabel(s: string | undefined): string {
  if (!s) return "—";
  const u = s.toUpperCase();
  if (u === "BULLISH") return "Bullish";
  if (u === "BEARISH") return "Bearish";
  if (u === "NEUTRAL") return "Neutral";
  return s;
}
