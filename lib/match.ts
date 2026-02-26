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
  // The guess must completely contain the correct answer
  return (
    (Boolean(zh) && g.includes(zh)) ||
    (Boolean(en) && g.includes(en))
  )
}
