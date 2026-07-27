// Curated Ardent Reapers decks, so the demo is playable without a trip to
// ardentreapers.com. Extend freely:
//   1. Paste a deck id from https://ardentreapers.com/decks
//   2. Use the deck API's own `name` field as `name` — GET
//      https://ardentreapers.com/api/decks/full/?deckId=<id>
//   3. Check the deck's card ids appear in cards.js — if they don't, that
//      deck's faces render as generated text cards instead of the real scans.
export const SEED_DECKS = [
  { id: 'f509a1b2-af8b-49b1-855c-2e2847cc31ae', name: 'Archpriest Minia Chruimes' },
  { id: 'fe1085f4-743c-4d2e-b49c-e890f4577f21', name: 'Sparda the Carries' },
];
