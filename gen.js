#!/usr/bin/env node
// gen.js — games.json is the single source of truth; this script keeps the
// derived files honest. Plain Node, no dependencies, not a build step: run it
// by hand after editing games.json and commit the output.
//
//   node gen.js          regenerate sitemap.xml, llms.txt, and the gallery
//                        tiles in index.html, then run all checks
//   node gen.js --check  regenerate nothing — fail (exit 1) if any derived
//                        file or any game's landing page disagrees with the
//                        manifest (this is what CI runs)
//
// The landing pages themselves are hand-written (the folder is the unit of
// copy-paste — see README), so those are *checked*, not generated: title
// pattern, canonical, meta description, og:image, JSON-LD, search phrases.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'games.json'), 'utf8'));
const BASE = manifest.baseUrl.replace(/\/+$/, '');
const games = manifest.games;

const problems = [];
const fail = (msg) => problems.push(msg);

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------- sitemap.xml

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!-- Generated from games.json by gen.js — do not hand-edit. -->',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  `  <url><loc>${BASE}/</loc></url>`,
  ...games.map((g) => `  <url><loc>${BASE}/${g.slug}/</loc></url>`),
  '</urlset>',
  '',
].join('\n');

// -------------------------------------------------------------------- llms.txt

const llms = [
  '# table.place demos',
  '',
  '> Free browser demos of tabletop games. Each page below is both a',
  '> "play X online" landing page and a working lobby creator: it turns the',
  '> game site\'s own deck data into a live multiplayer table on',
  '> https://table.place. No install, no account, no framework, no build',
  '> step — MIT licensed, view source is the tutorial.',
  '',
  'Generated from games.json by gen.js — regenerate with `node gen.js`.',
  '',
  '## Games',
  '',
  ...games.map(
    (g) =>
      `- [${g.name}](${BASE}/${g.slug}/): ${g.tagline} (${g.kind}; official site: ${g.officialSite})`
  ),
  '',
  '## Create a lobby programmatically',
  '',
  'Lobbies are seeded with one POST to the CORS-open, keyless public API:',
  '',
  '- https://api.table.place/llms.txt — canonical lobby API reference, self-contained; written so an LLM can emit a valid pack from it',
  '- https://table.place/llms.txt — the table.place client and pack/scenario format',
  '',
  '## Source',
  '',
  '- https://github.com/JollyGrin/tableplace-demos — this gallery, one self-contained folder per game',
  '',
].join('\n');

// --------------------------------------------------- gallery tiles (index.html)

const TILE_START = '<!-- tiles:generated from games.json — edit there, then `node gen.js` -->';
const TILE_END = '<!-- /tiles:generated -->';

const tiles = [
  TILE_START,
  '  <ul class="tiles">',
  ...games.flatMap((g) => [
    '    <li>',
    `      <a class="tile" href="${g.slug}/">`,
    `        <h2>${esc(g.name)}</h2>`,
    `        <span class="tier">${esc(g.tierNote)}</span>`,
    `        <p>${esc(g.tagline)}</p>`,
    '      </a>',
    '    </li>',
  ]),
  '  </ul>',
  `  ${TILE_END}`,
].join('\n');

function spliceTiles(html) {
  const start = html.indexOf(TILE_START);
  const end = html.indexOf(TILE_END);
  if (start === -1 || end === -1) {
    fail(`index.html: tile markers missing — expected "${TILE_START}" … "${TILE_END}"`);
    return null;
  }
  return html.slice(0, start) + tiles + html.slice(end + TILE_END.length);
}

// ------------------------------------------------------- write or compare

function emit(file, want) {
  const p = path.join(ROOT, file);
  const have = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  if (CHECK) {
    if (have !== want) fail(`${file}: out of date with games.json — run \`node gen.js\``);
  } else if (have !== want) {
    fs.writeFileSync(p, want);
    console.log(`wrote ${file}`);
  }
}

emit('sitemap.xml', sitemap);
emit('llms.txt', llms);

{
  const p = path.join(ROOT, 'index.html');
  const html = fs.readFileSync(p, 'utf8');
  const want = spliceTiles(html);
  if (want !== null) emit('index.html', want);
}

// ------------------------------------------- landing-page checks (per game)

// The landing page is hand-written; these assertions are the contract between
// it and the manifest, so neither can silently drift.
function meta(html, attr, name) {
  const re = new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`, 'i');
  const m = html.match(re);
  return m ? m[1] : null;
}

for (const g of games) {
  const page = path.join(ROOT, g.slug, 'index.html');
  const where = `${g.slug}/index.html`;
  if (!fs.existsSync(page)) {
    fail(`${where}: missing — every games.json entry needs a landing page folder`);
    continue;
  }
  const html = fs.readFileSync(page, 'utf8');
  const url = `${BASE}/${g.slug}/`;

  const wantTitle = `Play ${g.name} Online — Free Digital Tabletop | table.place demos`;
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
  if (title !== wantTitle) fail(`${where}: <title> is "${title}", want "${wantTitle}"`);

  const canonical = (html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/) || [])[1];
  if (canonical !== url) fail(`${where}: canonical is "${canonical}", want "${url}"`);

  if (meta(html, 'name', 'description') !== g.description)
    fail(`${where}: meta description differs from games.json description`);
  if (meta(html, 'property', 'og:image') !== BASE + g.ogImage)
    fail(`${where}: og:image differs from games.json ogImage (${BASE + g.ogImage})`);
  if (!meta(html, 'name', 'twitter:card')) fail(`${where}: twitter:card missing`);
  if (!fs.existsSync(path.join(ROOT, g.ogImage.replace(/^\//, ''))))
    fail(`${where}: ogImage file ${g.ogImage} does not exist in the repo`);

  const ld = (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  if (!ld) {
    fail(`${where}: JSON-LD <script> missing`);
  } else {
    try {
      const doc = JSON.parse(ld);
      const nodes = doc['@graph'] || [doc];
      const game = nodes.find((n) => n['@type'] === 'VideoGame');
      if (!game) fail(`${where}: JSON-LD has no VideoGame node`);
      else {
        if (game.name !== g.name) fail(`${where}: JSON-LD VideoGame.name !== "${g.name}"`);
        if (game.url !== url) fail(`${where}: JSON-LD VideoGame.url !== "${url}"`);
        if (game.gamePlatform !== 'Web browser') fail(`${where}: JSON-LD gamePlatform !== "Web browser"`);
      }
      const app = nodes.find((n) => n['@type'] === 'WebApplication');
      if (!app || !app.potentialAction)
        fail(`${where}: JSON-LD needs a WebApplication node with a potentialAction`);
    } catch (e) {
      fail(`${where}: JSON-LD does not parse: ${e.message}`);
    }
  }

  const lower = html.toLowerCase();
  for (const phrase of g.searchPhrases) {
    if (!lower.includes(phrase.toLowerCase()))
      fail(`${where}: page copy never says "${phrase}" (listed in games.json searchPhrases)`);
  }

  if (!html.includes(g.officialSite)) fail(`${where}: no link to official site ${g.officialSite}`);
}

// ----------------------------------------------------------------- verdict

if (problems.length) {
  console.error(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`OK — sitemap.xml, llms.txt, index.html tiles, and ${games.length} landing page(s) agree with games.json`);
