// ardent-reapers/adapter.js — Ardent Reapers deck JSON -> table.place player pack.
//
// This file is the whole integration: one function from the shape their API
// already serves to the shape api.table.place accepts. Everything else in the
// folder is UI. Pack format reference: https://table.place/llms.txt (§5, §6).
//
// Input is the response of
//   https://ardentreapers.com/api/decks/full/?deckId=<uuid>
// of which we use: id, name, and cards[] { id, title, type, victory_points }.
// Victory points, type and rarity are printed on the card face, so they are
// not modelled as data — the game plays entirely off the card art. They do
// appear in the placeholder face TEXT (see faceRef) so the cards stay legible
// until real scans render.

import { CARD_IMAGES } from './cards.js';

const SPEC_VERSION = '1.5.0';

// One neutral back for every deck. Ardent Reapers ships no reachable card-back
// asset (their bundle carries card fronts and set/type icons only), so the
// demo generates a labelled back. On your own site: use your real back image.
const CARD_BACK =
  'https://placehold.co/750x1050/26130f/c9a15a/png?text=ARDENT%5CnREAPERS&font=oswald';

// Card face ref. The real scans on ardentreapers.com are served WITHOUT CORS
// headers, and table.place loads plain https faces as WebGL textures with
// crossOrigin="anonymous" — so hotlinking them directly renders blank cards
// (verified in the client, not guessed). Instead each face is a `sheet:` ref
// (https://table.place/llms.txt § 5.3) treating the scan as a 1×1 sprite
// sheet: the client's sheet pipeline fetches it more forgivingly (including a
// proxy retry), slices it once, and caches the cell — so the REAL card art
// renders. And when the image genuinely can't be fetched, the documented
// fallback is a generated text placeholder drawn from `name`, which is why
// the label below carries title, type and victory points: worst case is a
// legible proxy card, never a blank one.
function faceRef(card) {
  const label = `${card.title} — ${card.type} · VP ${card.victory_points}`;
  const scan = CARD_IMAGES[card.id] ?? `https://ardentreapers.com/missing-scan/${card.id}.png`;
  return `sheet:${JSON.stringify({ url: scan, cols: 1, rows: 1, index: 0, name: label })}`;
}

// Fisher–Yates. The deck slot is dealt face-down in seat order, so the shuffle
// happens here, once, at pack build time.
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// deck: the API response above. seat: 0 or 1 (packs are sent in seat order).
export function deckToPack(deck, seat) {
  // Deck lists repeat a card per copy with the same id; a card `code` must be
  // unique within its deck, so copies get a -2, -3… suffix.
  const seen = new Map();
  const cards = shuffle(deck.cards).map((card) => {
    const n = (seen.get(card.id) || 0) + 1;
    seen.set(card.id, n);
    return {
      code: n === 1 ? card.id : `${card.id}-${n}`,
      name: card.title,
      face: faceRef(card),
    };
  });

  return {
    $schema: 'https://table.place/pack.schema.json',
    tbpp: 1,
    specVersion: SPEC_VERSION,
    id: `ardent-reapers-seat-${seat}-${deck.id}`,
    name: deck.name,
    scope: 'player',
    decks: [
      // duel-2p deals `deck` face-down and `discard` face-up; an empty
      // discard starts an empty pile beside the deck.
      { slot: 'deck', name: deck.name, back: CARD_BACK, cards },
      { slot: 'discard', name: 'Discard', back: CARD_BACK, cards: [] },
    ],
  };
}
