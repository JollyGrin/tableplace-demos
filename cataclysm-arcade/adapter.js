// cataclysm-arcade/adapter.js — the-cade.com pack/deck JSON -> table.place lobby body.
//
// This file is the whole integration: from the shapes the-cade.com's API already
// serves to the request api.table.place accepts. Everything else in the folder
// is UI. Pack format reference: https://api.table.place/llms.txt (§ 4, § 4.5).
//
// Two input shapes, both keyed by the same kebab-case card ids:
//   GET /api/packs/<uuid> — booster pack: { name, bossId, tokenId, cards: [id…] }
//   GET /api/decks/<uuid> — constructed:  { name, bossId, cards: {id: qty}, sideboard: {id: qty} }
// Card ids resolve against data/cards.json (a vendored snapshot of the site's
// own /cards.json — their API is unversioned, so the demo does not depend on
// its card DB staying up, only on the pack/deck endpoints the user pastes).
//
// The table both shapes compose to (cataclysmarcade.com/learn-to-play):
// per seat a Boss card face-up in play, the draw deck, an empty discard, a
// boss-health counter and a coin counter; shared, a level counter and two
// infinite bags of damage / +1 Attack counters. Booster packs add a pile of
// their named token card; constructed decks add their sideboard as a pile.
// The fighter row and the hand are felt space and the client's hand zone —
// nothing to compose.

const SPEC_VERSION = '1.5.0';
const SITE = 'https://the-cade.com';

// One neutral back for every pile. the-cade.com ships card fronts only (any
// /Artwork path we probed for a back answers with the SPA's index.html), so
// the demo generates a labelled back. On your own site: use your real back.
const CARD_BACK =
  'https://placehold.co/750x1050/0d0f1d/62e6c4/png?text=CATACLYSM%5CnARCADE&font=oswald';

// Card face ref. the-cade.com serves images with CORS pinned to its own origin
// (`access-control-allow-origin: https://the-cade.com`), and table.place loads
// plain https faces as WebGL textures with crossOrigin="anonymous" — so
// hotlinking them renders blank cards. Each face is instead a `sheet:` ref
// (https://table.place/llms.txt § 5.3) treating the scan as a 1×1 sprite
// sheet: the client's sheet pipeline fetches it more forgivingly (including a
// proxy retry), slices it once, and caches the cell — so the REAL art renders.
// When the image genuinely can't be fetched the documented fallback is a text
// placeholder drawn from `name`, which is why the label carries the stats: the
// worst case is a legible proxy card, never a blank one.
function faceRef(card) {
  const stats = card.attack != null && card.health != null ? ` · ${card.attack}/${card.health}` : '';
  const label = `${card.fullName} — ${card.type}${stats}`;
  return `sheet:${JSON.stringify({ url: SITE + card.image, cols: 1, rows: 1, index: 0, name: label })}`;
}

/** cards.json rows by id — built once from the vendored snapshot. */
export function indexCards(snapshot) {
  return new Map(snapshot.cards.map((card) => [card.id, card]));
}

// A card id the snapshot lacks is a stop, not a blank card on the table: the
// pile would be quietly short. The message names every missing id at once.
function resolveAll(ids, cardsById, what) {
  const missing = [...new Set(ids.filter((id) => !cardsById.has(id)))];
  if (missing.length) {
    throw new Error(
      `${what} uses ${missing.length === 1 ? 'a card' : `${missing.length} cards`} this demo's snapshot ` +
        `does not know: ${missing.join(', ')}. The vendored data/cards.json is dated — refresh it from ` +
        `${SITE}/cards.json.`
    );
  }
  return ids.map((id) => cardsById.get(id));
}

// {id: qty} -> [{ card, code }] with -2, -3… suffixes on the extra copies,
// because a card `code` must be unique within its deck. (No collision with
// real ids: they are kebab-case names, and 'x' with 3 copies would need a
// literal card id 'x-2' to clash — there is none in the 163-card set.)
function expandCopies(entries, cardsById, what) {
  const rows = [];
  for (const [id, qty] of entries) {
    const [card] = resolveAll([id], cardsById, what);
    for (let n = 1; n <= qty; n++) rows.push({ card, code: n === 1 ? id : `${id}-${n}` });
  }
  return rows;
}

const asCard = ({ card, code }) => ({ code, name: card.fullName, face: faceRef(card) });

/** A booster pack response has `cards` as an array; a constructed deck, a map. */
export function isBooster(source) {
  return Array.isArray(source.cards);
}

// One seat's pack. `seat` is 0 or 1; packs are sent in seat order. Positions
// authored on `pieces` are seat-0 coordinates — the composer mirrors them
// about the origin for seat 1, so the shared pieces ride on seat 0's pack.
export function sourceToPack(source, cardsById, seat) {
  const name = source.name || (isBooster(source) ? 'Booster pack' : 'Constructed deck');
  if (!source.bossId) {
    throw new Error(`"${name}" names no bossId — a Cataclysm Arcade table starts with a Boss in play.`);
  }
  const [boss] = resolveAll([source.bossId], cardsById, `"${name}"`);

  const mainRows = isBooster(source)
    ? resolveAll(source.cards, cardsById, `"${name}"`).map((card) => ({ card, code: card.id }))
    : expandCopies(Object.entries(source.cards ?? {}), cardsById, `"${name}"`);
  if (mainRows.length === 0) {
    throw new Error(`"${name}" has no cards in its main deck — nothing to deal.`);
  }

  const decks = [
    { slot: 'deck', name, back: CARD_BACK, cards: mainRows.map(asCard) },
    { slot: 'discard', name: 'Discard', back: CARD_BACK, cards: [] },
    // the Boss starts in play: a one-card pile the placement deals face-up
    { slot: 'boss', name: boss.fullName, back: CARD_BACK, cards: [asCard({ card: boss, code: boss.id })] }
  ];

  // booster packs name a token card; effects create copies, so deal a pile of
  // five — tokens cease to exist off-table, players just return them
  if (isBooster(source) && source.tokenId) {
    const [token] = resolveAll([source.tokenId], cardsById, `"${name}"`);
    decks.push({
      slot: 'tokens',
      name: `${token.fullName} tokens`,
      back: CARD_BACK,
      cards: expandCopies([[token.id, 5]], cardsById, `"${name}"`).map(asCard)
    });
  }

  const sideboard = isBooster(source) ? [] : Object.entries(source.sideboard ?? {});
  if (sideboard.length) {
    decks.push({
      slot: 'sideboard',
      name: 'Sideboard',
      back: CARD_BACK,
      cards: expandCopies(sideboard, cardsById, `"${name}" (sideboard)`).map(asCard)
    });
  }

  // Positions live inside the fixed seat camera's frame (roughly x ∈ [-8, 11],
  // z ∈ [-7, 7] from either chair — there is no pan or zoom to find strays with).
  const pieces = [
    // starts full at the Boss's printed health (the placement sends no `value`)
    { kind: 'counter', name: 'Boss health', color: '#c94f4f', maxValue: boss.health ?? 17, position: [3.4, 6.2] },
    // coins reset every level; you gain coins equal to the level, so level 1 deals 1
    { kind: 'counter', name: 'Coins', color: '#e0b84f', maxValue: 20, position: [5.4, 6.2] }
  ];
  if (seat === 0) {
    pieces.push(
      { kind: 'counter', name: 'Level', color: '#8f7fe8', maxValue: 20, position: [-6, 0] },
      {
        kind: 'bag', name: 'Damage counters', color: '#b3372f', infinite: true, position: [-6.5, 2.4],
        contents: [{ kind: 'counter', name: 'Damage', color: '#b3372f', maxValue: 99 }]
      },
      {
        kind: 'bag', name: '+1 Attack counters', color: '#2f6db3', infinite: true, position: [-6.5, -2.4],
        contents: [{ kind: 'counter', name: '+1 Attack', color: '#2f6db3', maxValue: 99 }]
      }
    );
  }

  return {
    $schema: 'https://table.place/pack.schema.json',
    tbpp: 1,
    specVersion: SPEC_VERSION,
    id: `cataclysm-arcade-seat-${seat}-${source.id}`,
    name,
    scope: 'player',
    decks,
    pieces
  };
}

// Extra piles follow the layout's own mirror: seat 1's row keeps the same x,
// flips z and turns 180 (compare `duel-2p`'s published geometry).
const at = (seat, [x, z]) => (seat === 1 ? { position: [x, -z], rotation: 180 } : { position: [x, z] });

/**
 * The whole request body for two the-cade.com sources (seat order).
 * `cardsById` is `indexCards(snapshot)` over data/cards.json.
 */
export function toLobbyBody(sources, cardsById) {
  const packs = sources.map((source, seat) => sourceToPack(source, cardsById, seat));

  const placements = [];
  packs.forEach((pack, seat) => {
    // the draw deck keeps the layout's spot but reshuffles on every load
    placements.push({ kind: 'deck', pack: pack.id, slot: 'deck', shuffle: true });
    // the Boss in play, face-up behind the fighter row
    placements.push({ kind: 'deck', pack: pack.id, slot: 'boss', faceUp: true, ...at(seat, [0.6, 6.2]) });
    if (pack.decks.some((deck) => deck.slot === 'tokens')) {
      placements.push({ kind: 'deck', pack: pack.id, slot: 'tokens', faceUp: true, ...at(seat, [-2.4, 6.2]) });
    }
    if (pack.decks.some((deck) => deck.slot === 'sideboard')) {
      placements.push({ kind: 'deck', pack: pack.id, slot: 'sideboard', ...at(seat, [13.5, 4.5]) });
    }
    // every piece needs a placement (llms.txt § 4.1 rule 8); no `position`
    // lands each at its authored spot, mirrored for seat 1. Coins and Level
    // start at 1 — the game starts at level 1 with one coin dealt.
    pack.pieces.forEach((piece, index) => {
      const startsAtOne = piece.name === 'Coins' || piece.name === 'Level';
      placements.push({ kind: 'piece', pack: pack.id, piece: index, ...(startsAtOne ? { value: 1 } : {}) });
    });
  });

  return { version: 1, layout: 'duel-2p', packs, placements };
}
