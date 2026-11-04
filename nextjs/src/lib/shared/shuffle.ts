/**
 * Shuffle an array in place with the Fisher-Yates algorithm.
 * Spec Reference: 05-bingo-card-generation.md, 22-card-shuffle.md
 *
 * @param array - The array to shuffle; it is reordered in place.
 */
export function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
