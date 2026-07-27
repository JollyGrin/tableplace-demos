# Ardent Reapers → table.place

Paste two deck links from [ardentreapers.com](https://ardentreapers.com), get a
seeded two-seat duel lobby. ~150 lines, no framework, no build step.

## Data tier: A

Their deck API is CORS-open JSON — the demo fetches it live from the browser:

```
GET https://ardentreapers.com/api/decks/full/?deckId=<uuid>
Access-Control-Allow-Origin: *
```

It is rate-limited (200 requests per window — the `RateLimit-*` headers say
so), which is why the demo fetches **on submit only**, never per keystroke.

## The adapter, explained

[`adapter.js`](adapter.js) is the entire mapping. Their deck JSON:

```json
{
  "id": "f509a1b2-…", "name": "Archpriest Minia Chruimes",
  "cards": [
    { "title": "Parasite", "type": "Creature", "rarity": "Rare",
      "victory_points": 1, "id": "c84f3771-…" }
  ]
}
```

becomes one `tbpp` player pack per seat (spec:
[table.place/llms.txt](https://table.place/llms.txt), pinned `specVersion
1.5.0`):

- **slot `deck`** — every card in the list, shuffled (Fisher–Yates, in the
  adapter). A deck lists one entry per physical copy, with the same card `id`;
  pack card `code`s must be unique per deck, so copies get `-2`, `-3`…
  suffixes.
- **slot `discard`** — present and empty. The `duel-2p` layout starts an
  empty face-up pile beside the deck for it.
- Card **name** comes from `title`. Victory points, type and rarity are
  *printed on the card face* — they are not modelled as data anywhere.

The lobby request itself is
[`../shared/seed.js`](../shared/seed.js): dry-run
`POST /v1/lobbies/validate` (its error messages are shown to you verbatim —
they are written for integrators), then `POST /v1/lobbies`, then render the
two seat links. API reference:
[api.table.place/llms.txt](https://api.table.place/llms.txt).

## Card faces: real scans via `sheet:` refs

The real scans exist on ardentreapers.com as Next.js build-hashed assets
(750×1050 PNG — [`cards.js`](cards.js) is the extracted card-id → URL map,
with provenance), but they are served **without CORS headers**, and
table.place loads plain `https:` faces as WebGL textures with
`crossOrigin="anonymous"` — so hotlinking them directly renders blank cards
(tested — a plain-URL face stays white while the same URL as a `sheet:` ref
renders).

So each face is instead a **`sheet:` ref** treating the scan as a 1×1 sprite
sheet ([table.place/llms.txt](https://table.place/llms.txt) § 5.3). The
client's sheet pipeline fetches the image more forgivingly (including a proxy
retry), slices it once, and caches the cell — the **real card art renders**.
If a sheet image genuinely can't be fetched, the format's documented fallback
is a generated text card drawn from the ref's `name` — which the adapter sets
to `title — type · VP n`, so the worst case is a legible placeholder, never a
blank card. Every deck shares one neutral generated back: they ship no
card-back asset at all (their bundle carries card fronts and icons only).

The hashed URLs are pinned to the site's current build — a redeploy that
re-hashes assets strands them (the fallback text card takes over). The
durable fix is the follow-up: re-host the scans inside this folder.

**On your own site none of this applies.** You have the real card images
server-side: point each card's `face` at them as plain URLs (CORS-readable
and hotlinkable, see § 5 of the API doc), point `back` at your real card
back, and delete `cards.js` and the `sheet:` wrapper entirely.

## What the demo deliberately does not do

- **No setup automation.** Ardent Reapers setup (discard from the top until
  two Creatures land, etc.) is performed by the players at the table, the
  same way they would at a real one.
- **No zone labels** (battle line / relics / score) and no decklist
  reference card — the `duel-2p` layout's deck + discard per seat is the
  whole arrangement.

## Do this on your own site

1. Copy this folder.
2. Replace `fetchDeck` + `adapter.js` with your own data shape → pack
   mapping (read [table.place/llms.txt](https://table.place/llms.txt) § 5–6).
3. Serve your card images from your own origin with
   `Access-Control-Allow-Origin: *`.
4. Keep the `validate` call — its errors are the integration debugger.

That's the whole thing. No accounts, no keys; the lobby API is CORS-open by
design.
