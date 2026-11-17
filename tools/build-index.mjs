#!/usr/bin/env node
/**
 * Builds a local draft index from your clone of the official GRID data
 * (cloud9esports/stl-hackathon-2026-grid-starter). Nothing is uploaded; the output is git-ignored.
 *
 *   node tools/build-index.mjs [--data ../stl-hackathon-2026-grid-starter] [--out .local/index.json]
 *
 * For each League of Legends series it streams the zstd JSON Lines feed, takes the final seriesState
 * (the README: "the last event in a file holds the final box score") and keeps, per game:
 *   - the ordered draft (draftActions: ban/pick, team, champion),
 *   - teams: side, win, kills, first-objective flags and counts (scuttles, grubs, drakes, herald, baron, towers),
 *   - players: name and champion, in roster order,
 *   - duration, patch and start time (from meta/games.csv).
 * Requires Node 22.15+ / 23.8+ (built-in zstd).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DATA = path.resolve(arg('--data', process.env.STL_DATA_DIR ?? '../stl-hackathon-2026-grid-starter'));
const OUT = path.resolve(arg('--out', '.local/index.json'));
if (!zlib.createZstdDecompress) { console.error('This Node.js has no built-in zstd. Use Node 22.15+ or 23.8+.'); process.exit(1); }

/** Minimal CSV parser (quoted fields, commas, newlines in quotes). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const OBJ = ['slayRiftScuttlerTop', 'slayRiftScuttlerBot', 'slayVoidGrub', 'slayRiftHerald', 'slayBaron', 'destroyTower'];
const isDrake = (t) => /^slay\w*Drake$/.test(t);

function slimGame(g, meta) {
  const teams = (g.teams ?? []).map((t) => {
    const obj = {};
    let drakes = 0;
    let firstDrake = false;
    for (const o of t.objectives ?? []) {
      if (OBJ.includes(o.type)) obj[o.type] = { n: o.completionCount ?? 0, first: !!o.completedFirst };
      if (isDrake(o.type)) { drakes += o.completionCount ?? 0; if (o.completedFirst) firstDrake = true; }
    }
    return {
      id: String(t.id), name: t.name, side: t.side, won: !!t.won, kills: t.kills ?? 0, firstKill: !!t.firstKill,
      drakes, obj,
      players: (t.players ?? []).map((p) => ({ id: String(p.id), name: p.name, champ: p.character?.name ?? null })),
    };
  });
  // "First drake" per team: the first team to slay any drake type. completedFirst is per drake type, so compare across teams.
  return {
    id: g.id,
    n: Number(meta?.game_number ?? 0),
    patch: meta?.patch ?? null,
    at: meta?.started_at ?? g.startedAt ?? null,
    secs: Math.round(g.clock?.currentSeconds ?? g.duration?.seconds ?? 0) || null,
    draft: (g.draftActions ?? []).slice().sort((a, b) => a.sequenceNumber - b.sequenceNumber).map((d) => ({ t: d.type, team: String(d.drafter?.id), champ: d.draftable?.name })),
    teams,
  };
}

async function readSeries(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createZstdDecompress()), crlfDelay: Infinity });
  let last = null;
  for await (const line of rl) {
    if (!line.includes('seriesState')) continue;
    const env = JSON.parse(line);
    for (const ev of env.events ?? []) if (ev.seriesState) last = ev.seriesState;
  }
  return last;
}

const series = parseCsv(fs.readFileSync(path.join(DATA, 'lol', 'series.csv'), 'utf8'));
const gamesMeta = new Map(parseCsv(fs.readFileSync(path.join(DATA, 'meta', 'games.csv'), 'utf8')).filter((g) => g.title === 'lol').map((g) => [g.game_id, g]));
const out = { builtAt: new Date().toISOString(), source: 'GRID data, cloud9esports/stl-hackathon-2026-grid-starter (local clone; do not redistribute)', series: [] };
let done = 0;
let failed = 0;
for (const s of series) {
  const file = path.join(DATA, s.file);
  if (!fs.existsSync(file)) continue;
  try {
    const st = await readSeries(file);
    if (!st) { failed++; continue; }
    out.series.push({
      id: s.series_id, event: s.event, stage: s.stage, at: s.scheduled_start,
      bestOf: st.format?.nameShortened ?? st.format?.name ?? null,
      teams: (st.teams ?? []).map((t) => ({ id: String(t.id), name: t.name, score: t.score ?? 0, won: !!t.won })),
      games: (st.games ?? []).filter((g) => g.started).map((g) => slimGame(g, gamesMeta.get(g.id))),
    });
  } catch (e) {
    failed++;
    console.error(`  ${s.series_id}: ${String(e.message).slice(0, 120)}`);
  }
  if (++done % 50 === 0) console.log(`${done}/${series.length} series`);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
const g = out.series.reduce((a, s) => a + s.games.length, 0);
console.log(`Wrote ${OUT}: ${out.series.length} series, ${g} games (${failed} failed). Keep it out of git.`);
