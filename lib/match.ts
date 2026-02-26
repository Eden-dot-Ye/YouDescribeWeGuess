/**
 * Checks if a guess matches the answer.
 * Rules:
 * - Case-insensitive
 * - Ignore Chinese/English distinction
 * - Fuzzy: guess contains the answer OR answer contains the guess (trimmed, normalized)
 */
export function isCorrectGuess(guess: string, answerZh: string, answerEn: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\s\-_,.!?'"]/g, '')
      .trim()

  const g = normalize(guess)
  if (!g) return false

  const zh = normalize(answerZh)
  const en = normalize(answerEn)

  // Exact or partial match for both Chinese and English
  return (
    g === zh ||
    g === en ||
    g.includes(zh) ||
    zh.includes(g) ||
    g === en ||
    g.includes(en) ||
    en.includes(g)
  )
}
