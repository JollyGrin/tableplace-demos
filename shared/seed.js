// shared/seed.js — the one shared module: validate, seed, render seat links.
//
// API reference: https://api.table.place/llms.txt  (canonical — read that, not this)
//
// The flow every demo uses:
//   1. POST /v1/lobbies/validate — the dry run. Same validation as the real
//      POST, but no lobby is created and nothing is spent against the shared
//      lobbies-per-hour cap. Its error messages are written for integrators;
//      surface them verbatim.
//   2. POST /v1/lobbies — once, after the dry run passes.
//   3. Render the seat links the 201 returns. They are the only handle on the
//      lobby — there is no lookup by name.

const API = 'https://api.table.place';

// Thrown when the API refuses a body. `message` is the API's own diagnosis,
// verbatim — show it to the user unedited.
export class SeedError extends Error {
  constructor(payload, status) {
    super(payload && payload.message ? payload.message : `HTTP ${status}`);
    this.name = 'SeedError';
    this.code = payload && payload.error;
    this.details = payload && payload.details;
  }
}

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new SeedError(data, res.status);
  return data;
}

// body: { version: 1, layout, packs, placements?, ttlSeconds? }
// Returns the 201 payload: { lobby, lobby_url, seats: [{seat, url}], expires_at }.
export async function seedLobby(body, onStatus = () => {}) {
  onStatus('validating request (dry run)…');
  await post('/v1/lobbies/validate', body);
  onStatus('creating lobby…');
  const lobby = await post('/v1/lobbies', body);
  onStatus('lobby created.');
  return lobby;
}

// Renders the seat links into `container` (an element). One link per seat,
// plus the spectator link. Hand one seat link to each player.
export function renderSeatLinks(container, lobby) {
  container.textContent = '';
  const list = document.createElement('ul');
  for (const seat of lobby.seats) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = seat.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = `Seat ${seat.seat} — ${seat.url}`;
    li.appendChild(a);
    list.appendChild(li);
  }
  container.appendChild(list);
  const note = document.createElement('p');
  note.textContent =
    `Lobby "${lobby.lobby}" expires ${new Date(lobby.expires_at).toLocaleTimeString()} — ` +
    'and an empty lobby is collected after ~15 minutes, so hand the links out now.';
  container.appendChild(note);
}
