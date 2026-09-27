/** Splits a class name into lower-case words: "EVChargingSpot" becomes ["ev", "charging", "spot"]. */
export function nameParts(name: string): string[] {
  return (name.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g) ?? [name]).map((w) => w.toLowerCase());
}

/**
 * True when the class name contains one of the synonyms as whole words.
 * "ParkingSpot" matches "spot" and "parkingspot"; "CardPayment" does not match "car".
 */
export function nameMatches(name: string, synonyms: readonly string[]): boolean {
  const parts = nameParts(name);
  const phrases = new Set<string>();
  for (let start = 0; start < parts.length; start += 1) {
    let phrase = '';
    for (let end = start; end < parts.length; end += 1) {
      phrase += parts[end];
      phrases.add(phrase);
    }
  }
  return synonyms.some((s) => phrases.has(s) || phrases.has(`${s}s`) || phrases.has(`${s}es`));
}

/** True when the prose uses one of the words (allowing a plural), ignoring case. */
export function textMentions(text: string, words: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((w) => new RegExp(`\\b${escapeRegExp(w)}(s|es)?\\b`).test(lower));
}

/** True when the prose contains one of the fragments anywhere ("concurren" matches "concurrency"). */
export function textContains(text: string, fragments: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return fragments.some((f) => lower.includes(f));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
