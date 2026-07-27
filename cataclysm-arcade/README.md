# Cataclysm Arcade → table.place

Paste a [the-cade.com](https://the-cade.com) booster-pack or constructed-deck
link for each seat, get a two-seat [table.place](https://table.place) lobby laid
out for [Cataclysm Arcade](https://cataclysmarcade.com): each seat's Boss card
face-up in play, its draw deck and discard, a boss-health counter and a coin
counter — plus a shared level counter and infinite bags of damage / +1 Attack
counters. Booster packs also deal a pile of their named token card; constructed
decks deal their sideboard as a face-down pile.

## Data tier: B

the-cade.com has a clean public JSON API — `GET /api/packs/<uuid>`,
`GET /api/decks/<uuid>`, and a full card DB at `GET /cards.json` — but its CORS
is pinned to its own origin (`access-control-allow-origin: https://the-cade.com`),
so a browser on this page cannot read it directly. The demo splits the
difference:

- **Card DB: vendored.** `data/cards.json` is a verbatim snapshot of the
  site's `/cards.json` (163 cards, fetched 2026-07-27 — provenance fields at
  the top of the file). Card ids are stable kebab-case slugs shared with
  cataclysmcodex.com, so the snapshot ages gracefully; an id it lacks fails
  with a message naming it, never a short pile.
- **Pack/deck fetch: live, via a CORS proxy.** The uuid the user pastes is
  fetched through the same public proxy the table.place client already uses
  for sheet images. On the-cade's own origin this indirection disappears —
  which is the concrete ask to the owner: serve `/api/*` (or just these two
  GETs) with an open `Access-Control-Allow-Origin` and this becomes a Tier A
  demo with no proxy and no snapshot.

Card images are also CORS-pinned, so faces are `sheet:` refs (1×1 sprite
sheets) rather than plain URLs — the client's sheet pipeline fetches them
forgivingly, and its documented fallback is a legible generated placeholder
carrying the card's name and stats, never a blank card.

## The adapter, explained

`adapter.js` is the whole integration. Both API shapes come keyed by the same
card ids:

```jsonc
// GET /api/packs/<uuid>  — booster: 14 singleton cards + a boss + a token
{ "name": "…", "bossId": "toolshed", "tokenId": "toolbox", "cards": ["data-spike", …] }
// GET /api/decks/<uuid>  — constructed: multi-copy map + sideboard
{ "name": "…", "bossId": "tryp-timelost", "cards": { "data-spike": 3, … }, "sideboard": { … } }
```

Per seat it emits one player pack: `deck` (copies expanded, `-2`/`-3` code
suffixes), an empty `discard` the layout deals face-up, a one-card `boss` pile
a placement deals face-up in play, and — booster only — a five-card `tokens`
pile / — constructed only — a face-down `sideboard` pile. Counters ride as
pack `pieces`; the shared level counter and the two counter bags ride on seat
0's pack, and every piece gets a `placements` entry (§ 4.1 rule 8 of
[api.table.place/llms.txt](https://api.table.place/llms.txt)). The boss-health
counter starts full at the Boss's printed health; Coins and Level start at 1.

## What the demo deliberately does not do

- **No opening hand.** Draw your 4 at the table; mulligans are table talk.
- **No rules.** Attack costs, the Line, level-ups — the cards and the players
  carry the game. The table gives zones, counters and dice, nothing else.
- **No fighter-row zone.** The row is the felt in front of your Boss, exactly
  as at a real table.
- **No validation of deck legality.** the-cade.com already validates its own
  formats (`valid: true` in its responses); an illegal deck still deals.

## Do this on your own site

Copy this folder, replace the two fetches with your own deck endpoint, and map
your card shape in `sourceToPack`. Validate first (`shared/seed.js` does), and
show the validator's messages verbatim — they are written for integrators and
are the integration debugger. The canonical reference is
<https://api.table.place/llms.txt>.

Card data and art belong to Mothership Games; the-cade.com and
cataclysmcodex.com are unofficial fan tools, and this demo is a demo — same
posture as every fan-content lobby here.
