import test from 'node:test';
import assert from 'node:assert/strict';
import { ORDER, fearlessLocked, firstDrafter, gamesOf, insights, predict, suggestBans, teamReport, teamsIn } from '../src/analyze.js';

// A tiny synthetic index (no GRID data in the repository).
function game(n, first, second, picksF, picksS, bansF, bansS, firstWins, at) {
  const draft = [];
  const bi = { F: 0, S: 0 };
  const pi = { F: 0, S: 0 };
  for (const o of ORDER) {
    const team = o.who === 'F' ? first : second;
    if (o.t === 'ban') draft.push({ t: 'ban', team, champ: (o.who === 'F' ? bansF : bansS)[bi[o.who]++] });
    else draft.push({ t: 'pick', team, champ: (o.who === 'F' ? picksF : picksS)[pi[o.who]++] });
  }
  const mk = (id, won, side, picks) => ({ id, name: id === 'A' ? 'Alpha' : 'Beta', side, won, kills: 10, firstKill: won, obj: { slayVoidGrub: { n: 3, first: won } }, players: picks.map((c, i) => ({ id: `${id}${i}`, name: `${id}p${i}`, champ: c })) });
  return { id: `g${n}${at}`, n, at, secs: 1800, draft, teams: [mk(first, firstWins, 'blue', picksF), mk(second, !firstWins, 'red', picksS)] };
}
const PA = ['Azir', 'Vi', 'Jinx', 'Rell', 'Gnar'];
const PB = ['Orianna', 'Sejuani', 'Kaisa', 'Nautilus', 'Ksante'];
const BAN = ['Rumble', 'Kalista', 'Varus', 'Yone', 'Corki'];
const index = {
  series: [1, 2, 3, 4, 5, 6].map((k) => ({
    id: `s${k}`, event: 'Test Split', at: `2026-0${k}-01`, teams: [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }],
    games: [
      game(1, 'A', 'B', PA, PB, BAN, ['Ashe', 'Skarner', 'Taliyah', 'Poppy', 'Leona'], k % 3 !== 0, `2026-0${k}-01T10`),
      game(2, 'B', 'A', PB.map((c) => c + '2'), PA.map((c) => c + '2'), ['Ashe', 'Skarner', 'Taliyah', 'Poppy', 'Leona'], BAN, false, `2026-0${k}-01T11`),
      game(3, 'A', 'B', PA.map((c) => c + '3'), PB.map((c) => c + '3'), BAN, ['Ashe', 'Skarner', 'Taliyah', 'Poppy', 'Leona'], false, `2026-0${k}-01T12`),
    ],
  })),
};

test('draft order and first drafter', () => {
  assert.equal(ORDER.length, 20);
  assert.deepEqual(ORDER.filter((o) => o.t === 'pick').map((o) => o.who).join(''), 'FSSFFSSFFS');
  assert.equal(firstDrafter(index.series[0].games[1]), 'B');
});

test('games, teams and report numbers', () => {
  assert.equal(gamesOf(index, 'A').length, 18);
  assert.equal(gamesOf(index, 'A', { lastN: 4 }).length, 4);
  assert.deepEqual(teamsIn(index).map((t) => t.name), ['Alpha', 'Beta']);
  const r = teamReport(index, 'A');
  assert.equal(r.games, 18);
  assert.equal(r.sides.first.n, 12);
  assert.equal(r.firstPicks[0].champ, 'Azir');
  assert.equal(r.firstPicks[0].pct, 50); // game 1 of 6 series (game 3 first pick is Azir3)
  assert.equal(r.bansPhase1.first[0].pct, 100);
  const azir = r.picks.find((p) => p.champ === 'Azir');
  assert.equal(azir.n, 6);
  assert.equal(azir.wr, 67); // wins 4 of 6
  assert.equal(r.byGame['3+'].n, 6);
  assert.ok(r.players.length >= 1);
});

test('insights carry evidence and need enough games', () => {
  const r = teamReport(index, 'A');
  const ins = insights(r, { slayVoidGrub: 20 });
  assert.ok(ins.some((i) => /Bans (Kalista|Rumble|Varus)/.test(i.text) && /12\/12/.test(i.evidence)));
  assert.ok(ins.some((i) => i.kind === 'fearless'));
  assert.ok(ins.every((i) => i.evidence));
  assert.match(insights(teamReport(index, 'A', { lastN: 2 }))[0].text, /too few/);
});

test('prediction respects availability; ban suggestions; fearless locks', () => {
  const r = teamReport(index, 'A');
  const avail = new Set(['Azir', 'Vi', 'Jinx']);
  const p = predict(r, avail, 'pick');
  assert.deepEqual(p.map((x) => x.champ).sort(), ['Azir', 'Jinx', 'Vi']);
  assert.ok(p.every((x) => x.p === 33)); // equal frequencies share evenly
  const banned = predict(r, new Set(['Rumble', 'Yone']), 'ban', 1, 'first');
  assert.deepEqual(banned.map((b) => b.champ), ['Rumble']); // Yone is a phase-2 ban for this team
  const s = suggestBans(r, new Set(['Azir', 'Vi']));
  assert.equal(s[0].champ, 'Azir');
  assert.match(s[0].why, /67% wins/);
  const lock = fearlessLocked(index.series[0].games.slice(0, 2));
  assert.ok(lock.has('Azir') && lock.has('Orianna2') && !lock.has('Rumble'));
});
