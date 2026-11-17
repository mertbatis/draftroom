/**
 * Draft Room analytics: pure functions over the local draft index (unit-tested in test/analyze.test.mjs).
 * Every number comes with its sample size, so coaches can see how strongly a tendency is supported.
 */

/** Pro draft order (verified on 1,719 of 1,721 complete drafts in the data). "F" = first drafter (blue), "S" = second. */
export const ORDER = [
  ['F', 'ban', 1], ['S', 'ban', 1], ['F', 'ban', 1], ['S', 'ban', 1], ['F', 'ban', 1], ['S', 'ban', 1],
  ['F', 'pick', 1], ['S', 'pick', 1], ['S', 'pick', 1], ['F', 'pick', 1], ['F', 'pick', 1], ['S', 'pick', 1],
  ['S', 'ban', 2], ['F', 'ban', 2], ['S', 'ban', 2], ['F', 'ban', 2],
  ['S', 'pick', 2], ['F', 'pick', 2], ['F', 'pick', 2], ['S', 'pick', 2],
].map(([who, t, phase], i) => ({ i, who, t, phase }));

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const inc = (m, k, by = 1) => m.set(k, (m.get(k) ?? 0) + by);
const sorted = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, n);

/** The team that made the first draft action drafts as "blue" (side labels are swapped in a few feeds). */
export const firstDrafter = (g) => g.draft[0]?.team ?? g.teams.find((t) => t.side === 'blue')?.id;

/**
 * Every game of a team, newest first, with its series context.
 * @param {object} index draft index
 * @param {string} teamId GRID team id
 * @param {{events?: string[]|null, lastN?: number|null, since?: string|null}} [filter]
 */
export function gamesOf(index, teamId, { events = null, lastN = null, since = null } = {}) {
  const out = [];
  for (const s of index.series) {
    if (!s.teams.some((t) => t.id === teamId)) continue;
    if (events && events.length && !events.includes(s.event)) continue;
    for (const g of s.games) {
      if (since && (g.at ?? s.at) < since) continue;
      const us = g.teams.find((t) => t.id === teamId);
      const them = g.teams.find((t) => t.id !== teamId);
      if (!us || !them || g.draft.length < 18) continue;
      out.push({ g, s, us, them, first: firstDrafter(g) === teamId, n: g.n || 1 });
    }
  }
  out.sort((a, b) => String(b.g.at ?? b.s.at).localeCompare(String(a.g.at ?? a.s.at)));
  return lastN ? out.slice(0, lastN) : out;
}

/** List of teams with how many games each has in the index. */
export function teamsIn(index) {
  const m = new Map();
  for (const s of index.series) for (const g of s.games) for (const t of g.teams) {
    const e = m.get(t.id) ?? { id: t.id, name: t.name, games: 0, last: '' };
    e.games++;
    e.name = t.name;
    if ((g.at ?? '') > e.last) e.last = g.at ?? '';
    m.set(t.id, e);
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const OBJ_LABEL = {
  firstBlood: 'first blood', slayRiftScuttlerTop: 'first top-side scuttle', slayRiftScuttlerBot: 'first bot-side scuttle',
  slayVoidGrub: 'first void grubs', slayRiftHerald: 'first Rift Herald', destroyTower: 'first tower', slayBaron: 'first Baron',
};

/** Rates of "first" objectives for a set of team-games. */
function objectiveRates(rows) {
  const out = {};
  for (const k of Object.keys(OBJ_LABEL)) {
    const have = rows.filter((r) => (k === 'firstBlood' ? true : r.us.obj && (r.us.obj[k] || r.them.obj?.[k])));
    const yes = have.filter((r) => (k === 'firstBlood' ? r.us.firstKill : r.us.obj?.[k]?.first)).length;
    out[k] = { label: OBJ_LABEL[k], yes, n: have.length, pct: pct(yes, have.length) };
  }
  return out;
}

/**
 * Full scouting report for one team.
 * @param {object} index draft index
 * @param {string} teamId GRID team id
 * @param {{events?: string[]|null, lastN?: number|null, since?: string|null}} [filter]
 */
export function teamReport(index, teamId, filter = {}) {
  const rows = gamesOf(index, teamId, filter);
  const r = { teamId, name: rows[0]?.us.name ?? teamId, games: rows.length, series: new Set(rows.map((x) => x.s.id)).size };
  const wins = rows.filter((x) => x.us.won).length;
  r.record = { w: wins, l: rows.length - wins };
  const asFirst = rows.filter((x) => x.first);
  const asSecond = rows.filter((x) => !x.first);
  r.sides = {
    first: { n: asFirst.length, w: asFirst.filter((x) => x.us.won).length },
    second: { n: asSecond.length, w: asSecond.filter((x) => x.us.won).length },
  };

  const bans = new Map();
  const bansP1 = { first: new Map(), second: new Map() };
  const bansAgainst = new Map();
  const picks = new Map();
  const pickWins = new Map();
  const firstPick = new Map();
  const byGame = { 1: new Map(), 2: new Map(), '3+': new Map() };
  const byGameN = { 1: 0, 2: 0, '3+': 0 };
  const players = new Map();
  for (const x of rows) {
    const key = x.n >= 3 ? '3+' : String(x.n);
    byGameN[key]++;
    x.g.draft.forEach((d, i) => {
      const mine = d.team === teamId;
      if (d.t === 'ban') {
        if (mine) { inc(bans, d.champ); if (ORDER[i]?.phase === 1) inc(bansP1[x.first ? 'first' : 'second'], d.champ); } else inc(bansAgainst, d.champ);
      } else if (mine) {
        inc(picks, d.champ);
        if (x.us.won) inc(pickWins, d.champ);
        inc(byGame[key], d.champ);
        if (i === 6 && x.first) inc(firstPick, d.champ);
      }
    });
    for (const p of x.us.players) {
      if (!p.champ) continue;
      const e = players.get(p.id) ?? { id: p.id, name: p.name, games: 0, champs: new Map() };
      e.games++;
      e.name = p.name;
      inc(e.champs, p.champ);
      players.set(p.id, e);
    }
  }
  const list = (m, n, den) => sorted(m, n).map(([champ, c]) => ({ champ, n: c, pct: pct(c, den) }));
  r.bans = list(bans, 15, rows.length);
  r.bansPhase1 = { first: list(bansP1.first, 8, asFirst.length), second: list(bansP1.second, 8, asSecond.length) };
  r.bansAgainst = list(bansAgainst, 15, rows.length);
  r.picks = sorted(picks, 25).map(([champ, c]) => ({ champ, n: c, pct: pct(c, rows.length), w: pickWins.get(champ) ?? 0, wr: pct(pickWins.get(champ) ?? 0, c) }));
  r.firstPicks = list(firstPick, 6, asFirst.length);
  r.byGame = Object.fromEntries(Object.entries(byGame).map(([k, m]) => [k, { n: byGameN[k], top: list(m, 8, byGameN[k]) }]));
  r.players = [...players.values()].filter((p) => p.games >= Math.max(2, rows.length * 0.2)).sort((a, b) => b.games - a.games).slice(0, 7)
    .map((p) => ({ id: p.id, name: p.name, games: p.games, distinct: p.champs.size, champs: sorted(p.champs, 8).map(([champ, c]) => ({ champ, n: c })) }));
  r.objectives = objectiveRates(rows);
  const mins = rows.map((x) => x.g.secs).filter(Boolean);
  r.avgMinutes = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length / 60) : null;
  r.fearless = fearlessShift(rows, teamId);
  return r;
}

/**
 * How a team's drafting changes as Fearless shrinks the pool: share of each game's picks that come from
 * outside the team's 15 most-picked champions (in this sample), by game number.
 */
export function fearlessShift(rows, teamId) {
  const all = new Map();
  for (const x of rows) for (const d of x.g.draft) if (d.t === 'pick' && d.team === teamId) inc(all, d.champ);
  const core = new Set(sorted(all, 15).map(([c]) => c));
  const by = {};
  for (const x of rows) {
    const key = x.n >= 3 ? '3+' : String(x.n);
    const mine = x.g.draft.filter((d) => d.t === 'pick' && d.team === teamId);
    const e = by[key] ?? { picks: 0, outside: 0, games: 0, wins: 0 };
    e.picks += mine.length;
    e.outside += mine.filter((d) => !core.has(d.champ)).length;
    e.games++;
    if (x.us.won) e.wins++;
    by[key] = e;
  }
  return Object.fromEntries(Object.entries(by).map(([k, e]) => [k, { ...e, outsidePct: pct(e.outside, e.picks), winPct: pct(e.wins, e.games) }]));
}

/** League-wide baseline over the same filter window (for "above average" statements). */
export function baseline(index, filter = {}) {
  const ids = teamsIn(index).map((t) => t.id);
  const acc = {};
  for (const id of ids) {
    const rows = gamesOf(index, id, { events: filter.events, since: filter.since });
    const o = objectiveRates(rows);
    for (const [k, v] of Object.entries(o)) { const a = acc[k] ?? { yes: 0, n: 0 }; a.yes += v.yes; a.n += v.n; acc[k] = a; }
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, pct(v.yes, v.n)]));
}

/** Plain-language tendencies, each with its evidence. Only patterns with enough games are stated. */
export function insights(r, base = {}) {
  const out = [];
  const min = 5;
  if (r.games < min) return [{ text: `Only ${r.games} games in this window: too few for reliable tendencies.`, evidence: `${r.games} games` }];
  for (const side of ['first', 'second']) {
    const b = r.bansPhase1[side][0];
    const n = r.sides[side].n;
    if (b && n >= min && b.pct >= 40) out.push({ kind: 'ban', text: `Bans ${b.champ} in the first phase in ${b.pct}% of games on ${side === 'first' ? 'blue (first pick)' : 'red'} side.`, evidence: `${b.n}/${n} games` });
  }
  const fp = r.firstPicks[0];
  if (fp && r.sides.first.n >= min && fp.pct >= 25) out.push({ kind: 'pick', text: `With first pick, takes ${fp.champ} ${fp.pct}% of the time.`, evidence: `${fp.n}/${r.sides.first.n} first-pick games` });
  const sig = r.picks.find((p) => p.n >= min && p.wr >= 65);
  if (sig) out.push({ kind: 'pick', text: `${sig.champ} is a comfort pick: ${sig.n} games, ${sig.wr}% wins.`, evidence: `${sig.w}-${sig.n - sig.w}` });
  const weak = r.picks.find((p) => p.n >= min && p.wr <= 35);
  if (weak) out.push({ kind: 'pick', text: `Keeps picking ${weak.champ} despite ${weak.wr}% wins.`, evidence: `${weak.w}-${weak.n - weak.w}` });
  const f1 = r.fearless['1'];
  const f3 = r.fearless['3+'];
  if (f1 && f3 && f3.games >= 3) {
    const d = f3.outsidePct - f1.outsidePct;
    out.push({ kind: 'fearless', text: `Fearless pressure: in games 3-5, ${f3.outsidePct}% of their picks come from outside their 15 most-played champions (game 1: ${f1.outsidePct}%), and they win ${f3.winPct}% of those games (game 1: ${f1.winPct}%).`, evidence: `${f3.games} late games, ${f1.games} game-1s`, strength: Math.abs(d) });
  }
  for (const [k, v] of Object.entries(r.objectives)) {
    const b = base[k];
    if (v.n >= min && b != null && Math.abs(v.pct - b) >= 15) out.push({ kind: 'macro', text: `Takes ${v.label} in ${v.pct}% of games (league ${b}%).`, evidence: `${v.yes}/${v.n} games` });
  }
  const f = r.sides.first;
  const s = r.sides.second;
  if (f.n >= min && s.n >= min && Math.abs(pct(f.w, f.n) - pct(s.w, s.n)) >= 20) out.push({ kind: 'side', text: `Wins ${pct(f.w, f.n)}% on blue but ${pct(s.w, s.n)}% on red.`, evidence: `${f.w}/${f.n} and ${s.w}/${s.n}` });
  return out;
}

/**
 * Likely next picks or bans for a team, among available champions: the team's own frequencies for that
 * action (phase-specific for bans), renormalised. Returns [{ champ, p, n }].
 */
export function predict(r, available, kind = 'pick', phase = 1, side = 'first', k = 5) {
  const src = kind === 'ban' ? (phase === 1 ? r.bansPhase1[side] : r.bans) : r.picks;
  const pool = src.filter((x) => available.has(x.champ));
  const total = pool.reduce((a, x) => a + x.n, 0);
  return pool.slice(0, k).map((x) => ({ champ: x.champ, n: x.n, p: pct(x.n, total) }));
}

/** Ban suggestions against an opponent: high pick rate and high win rate, still available. */
export function suggestBans(opp, available, k = 5) {
  return opp.picks
    .filter((p) => available.has(p.champ) && p.n >= 2)
    .map((p) => ({ ...p, score: (p.n / Math.max(1, opp.games)) * (0.3 + p.wr / 100) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((p) => ({ champ: p.champ, why: `${p.n} picks in ${opp.games} games, ${p.wr}% wins` }));
}

/** Fearless: champions locked for the rest of the series (picked by either team in earlier games). */
export function fearlessLocked(seriesGames) {
  const s = new Set();
  for (const g of seriesGames) for (const d of g.draft) if (d.t === 'pick' && d.champ) s.add(d.champ);
  return s;
}
