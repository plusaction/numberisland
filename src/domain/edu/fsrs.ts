/**
 * Simplified FSRS-style spaced review (SPEC §9.4): stability (days) + difficulty (1..10).
 * Days are integers supplied by the caller (local calendar day number) to keep this pure.
 */
export type ReviewRating = 'again' | 'hard' | 'good';

export interface ReviewCard {
  /** e.g. `A5:SUB_BORROW` */
  id: string;
  stability: number;
  difficulty: number;
  due: number;
  lapses: number;
  reps: number;
}

export function newCard(id: string, today: number): ReviewCard {
  return { id, stability: 1, difficulty: 5, due: today + 1, lapses: 0, reps: 0 };
}

export function reviewCard(card: ReviewCard, rating: ReviewRating, today: number): ReviewCard {
  let { stability, difficulty, lapses } = card;
  if (rating === 'again') {
    stability = Math.max(0.5, stability * 0.4);
    difficulty = Math.min(10, difficulty + 1.5);
    lapses += 1;
  } else if (rating === 'hard') {
    stability = stability * 1.2 + 0.2;
    difficulty = Math.min(10, difficulty + 0.3);
  } else {
    stability = stability * (1 + 0.35 * (11 - difficulty) * 0.3) + 0.5;
    difficulty = Math.max(1, difficulty - 0.4);
  }
  const interval = rating === 'again' ? 1 : Math.max(1, Math.round(stability));
  return { ...card, stability, difficulty, lapses, reps: card.reps + 1, due: today + interval };
}

export function dueCards(cards: readonly ReviewCard[], today: number): ReviewCard[] {
  return cards.filter((c) => c.due <= today).sort((a, b) => a.due - b.due || b.difficulty - a.difficulty);
}
