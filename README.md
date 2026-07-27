# tableplace-demos

A gallery of tiny lobby creators — **one folder per game** — each proving the
same thing: any game site can turn its own deck/card data into a playable
[table.place](https://table.place) lobby with one POST.

These are proofs of concept built to be **stolen**. Each demo is a single
self-contained folder of plain HTML + JS modules — no framework, no build
step — so a game-site owner can view source, copy the folder, and adapt it to
their own stack in an afternoon. MIT licensed to make that explicit.

## How every demo works

1. **Fetch the game's own data** — the deck/card JSON the game site already
   serves (or a snapshot of it, see tiers below).
2. **Map it to a pack + scenario** — the two tableplace artifacts:
   a *pack* is the content library (decks, cards, pieces), a *scenario* is
   the arrangement (seats, starting zones). `adapter.js` in each demo is
   exactly this mapping and nothing else.
3. **Seed a lobby** — `POST https://api.table.place/v1/lobbies`, then render
   the seat links it returns. Done.

The canonical API documentation is **<https://api.table.place/llms.txt>** —
one URL, self-contained, written so an LLM (or you) can emit a valid pack
from it. Demos link to it and never restate it; restated docs drift.

## Repo rules

- **One folder per game, fully self-contained.** The folder is the unit of
  copy-paste. Duplication between demos is fine; a shared component library
  is not the product here.
- **The only shared code is `shared/seed.js`** — validate via
  `POST /v1/lobbies/validate` first (friendly errors), then seed, then
  render seat links.
- **No frameworks, no build step.** View-source is the tutorial.
- **Declare your data tier** in each demo's README:
  - **Tier A** — the game site serves JSON with `Access-Control-Allow-Origin`
    open: the demo fetches live. Best story.
  - **Tier B** — JSON exists but CORS blocks cross-origin reads: the demo
    uses a checked-in snapshot. Note for the owner: on your own origin this
    problem doesn't exist.
  - **Tier C** — no machine-readable data: snapshot checked in, and the
    README's ask to the owner is concrete ("expose a deck JSON export, or
    build the POST server-side where you already have the data").
- **Snapshots carry provenance.** Any checked-in game data starts with a
  comment/field naming the source URL and fetch date.
- **Emitted documents pin their spec version.** Packs/scenarios carry
  `specVersion`; validate before seeding rather than guessing.

## Layout

```
index.html              # the gallery: one tile per game
shared/seed.js          # validate → POST /v1/lobbies → seat links
<game-name>/
  index.html            # the lobby creator UI
  adapter.js            # game data → pack + scenario
  data/                 # snapshot(s) with provenance (Tier B/C only)
  README.md             # data tier + "do this on your own site" notes
```

## For game-site owners

Copy the folder of the demo closest to your game. Replace the adapter with
your own data shape. Read <https://api.table.place/llms.txt>. That's the
whole integration — the lobby API is CORS-open and needs no key for the
public tier.
