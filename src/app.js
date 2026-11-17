/** Draft Room UI: scouting report, Fearless series board, self-scout. */
import { ORDER, baseline, fearlessLocked, insights, pct, predict, suggestBans, teamReport, teamsIn } from './analyze.js';
import { allChampions, champTile, loadDataDragon } from './champs.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let index = null;
let teams = [];
let base = {};
const SERIES_KEY = 'draftroom.series.v1';

// ------------------------------------------------------------------ data loading
async function boot() {
  await loadDataDragon();
  try {
    const res = await fetch('local-index.json', { cache: 'no-store' });
    if (res.ok) return setIndex(await res.json(), 'local clone (served by serve.mjs)');
  } catch { /* not served locally */ }
  setIndex(null);
}
$('#file').addEventListener('change', async (e) => {
  try { setIndex(JSON.parse(await e.target.files[0].text()), e.target.files[0].name); } catch { alert('That file is not a Draft Room index.'); }
});

function setIndex(ix, from) {
  index = ix;
  $('#empty').hidden = !!ix;
  $('#dataStatus').className = `pill ${ix ? 'ok' : 'warn'}`;
  $('#dataStatus').textContent = ix ? `${ix.series.length} series · ${ix.series.reduce((a, s) => a + s.games.length, 0)} games · ${from}` : 'No match data loaded';
  teams = ix ? teamsIn(ix).filter((t) => t.games >= 3) : [];
  const opt = (t) => `<option value="${t.id}">${esc(t.name)} (${t.games})</option>`;
  $('#us').innerHTML = teams.map(opt).join('');
  $('#opp').innerHTML = teams.map(opt).join('');
  const c9 = teams.find((t) => /^Cloud9/.test(t.name));
  if (c9) $('#us').value = c9.id;
  const rivals = c9 ? teams.filter((t) => t.id !== c9.id && sameLeague(t.id, c9.id)) : teams;
  const opp = rivals.sort((a, b) => b.last.localeCompare(a.last))[0] ?? teams[1];
  if (opp) $('#opp').value = opp.id;
  const events = ix ? [...new Set(ix.series.map((s) => s.event))] : [];
  $('#win').innerHTML = `<option value="2026">2026 matches</option><option value="all">All matches</option>${events.map((e) => `<option value="ev:${esc(e)}">${esc(e)}</option>`).join('')}`;
  render();
}
function sameLeague(a, b) { return index.series.some((s) => s.teams.some((t) => t.id === a) && s.teams.some((t) => t.id === b)); }

function filter() {
  const w = $('#win').value;
  const lastN = Number($('#lastN').value) || null;
  if (w === '2026') return { since: '2026-01-01', lastN };
  if (w.startsWith('ev:')) return { events: [w.slice(3)], lastN };
  return { lastN };
}
for (const id of ['#us', '#opp', '#win', '#lastN']) $(id).addEventListener('change', () => render());
document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x.id === b.dataset.tab));
}));

let usR = null;
let oppR = null;
function render() {
  if (index) {
    const f = filter();
    base = baseline(index, f);
    usR = teamReport(index, $('#us').value, f);
    oppR = teamReport(index, $('#opp').value, f);
    $('#scout').innerHTML = report(oppR, `Scouting ${esc(oppR.name)}`, true);
    $('#self').innerHTML = report(usR, `What opponents can read about ${esc(usR.name)}`, false);
  } else {
    $('#scout').innerHTML = '';
    $('#self').innerHTML = '';
  }
  renderSeries();
}

// ------------------------------------------------------------------ report
const chipList = (xs, f = (x) => `${x.n}`) => `<div class="chips">${xs.map((x) => `<span class="chip">${champTile(x.champ, { size: 26 })}${esc(x.champ)} <b>${f(x)}</b></span>`).join('') || '<span class="muted small">—</span>'}</div>`;
const barRow = (x, den) => `<tr><td>${champTile(x.champ, { size: 26 })} ${esc(x.champ)}</td><td class="num">${x.n}/${den}</td><td><div class="bar"><i style="width:${x.pct}%"></i></div></td><td class="num">${x.pct}%</td></tr>`;

function report(r, title, vsUs) {
  if (!r.games) return `<p class="muted">No games for this team in this window.</p>`;
  const ins = insights(r, base);
  const bans = vsUs ? suggestBans(r, new Set(r.picks.map((p) => p.champ))) : [];
  const fl = r.fearless;
  return `
  <h2>${title}</h2>
  <div class="tiles">
    <div><b>${r.games}</b><span>games · ${r.series} series</span></div>
    <div><b>${r.record.w}-${r.record.l}</b><span>record (${pct(r.record.w, r.games)}%)</span></div>
    <div><b>${r.sides.first.w}/${r.sides.first.n}</b><span>wins as first drafter (blue)</span></div>
    <div><b>${r.sides.second.w}/${r.sides.second.n}</b><span>wins as second drafter (red)</span></div>
    <div><b>${r.avgMinutes ?? '—'}</b><span>avg minutes</span></div>
  </div>
  <div class="grid">
    <div class="card" style="grid-column:1/-1"><h3>Tendencies (with evidence)</h3><ul class="ins">${ins.map((i) => `<li><span class="k ${i.kind ?? ''}">${esc(i.kind ?? 'note')}</span><span>${esc(i.text)}</span><span class="ev">${esc(i.evidence)}</span></li>`).join('')}</ul></div>
    ${vsUs ? `<div class="card"><h3>Ban suggestions vs ${esc(r.name)}</h3>${bans.map((b) => `<div class="chip" style="margin:4px 0">${champTile(b.champ, { size: 28 })}<b>${esc(b.champ)}</b><span class="muted small">${esc(b.why)}</span></div>`).join('')}<p class="muted small">Score = their pick rate × (0.3 + win rate). Use with the Fearless board: suggestions skip champions already locked.</p></div>` : ''}
    <div class="card"><h3>Phase-1 bans · as blue</h3><table>${r.bansPhase1.first.slice(0, 6).map((x) => barRow(x, r.sides.first.n)).join('')}</table></div>
    <div class="card"><h3>Phase-1 bans · as red</h3><table>${r.bansPhase1.second.slice(0, 6).map((x) => barRow(x, r.sides.second.n)).join('')}</table></div>
    <div class="card"><h3>Most picked (win rate)</h3><table><tr><th>Champion</th><th class="num">Games</th><th class="num">Wins</th></tr>${r.picks.slice(0, 10).map((p) => `<tr><td>${champTile(p.champ, { size: 26 })} ${esc(p.champ)}</td><td class="num">${p.n}</td><td class="num">${p.wr}%</td></tr>`).join('')}</table></div>
    <div class="card"><h3>First pick (as blue)</h3>${chipList(r.firstPicks, (x) => `${x.n}/${r.sides.first.n}`)}<h3 style="margin-top:14px">Bans they face most</h3>${chipList(r.bansAgainst.slice(0, 8), (x) => `${x.pct}%`)}</div>
    <div class="card"><h3>Fearless: picks by game number</h3>${['1', '2', '3+'].map((k) => `<p class="small muted">Game ${k} · ${r.byGame[k].n} games · ${fl[k] ? `${fl[k].outsidePct}% outside top-15 pool · ${fl[k].winPct}% wins` : ''}</p>${chipList(r.byGame[k].top.slice(0, 6), (x) => `${x.n}`)}`).join('')}</div>
    <div class="card"><h3>Player champion pools</h3>${r.players.map((p) => `<p class="small"><b>${esc(p.name)}</b> <span class="muted">${p.games} games · ${p.distinct} champions</span></p>${chipList(p.champs.slice(0, 6), (x) => x.n)}`).join('')}</div>
    <div class="card"><h3>Early objectives vs league</h3><table><tr><th>Objective</th><th class="num">Took first</th><th class="num">League</th></tr>${Object.entries(r.objectives).map(([k, o]) => `<tr><td>${esc(o.label)}</td><td class="num">${o.pct}% <span class="muted">(${o.yes}/${o.n})</span></td><td class="num">${base[k] ?? '—'}%</td></tr>`).join('')}</table><p class="muted small">Scuttle sides hint at the jungler's opening route.</p></div>
  </div>`;
}

// ------------------------------------------------------------------ Fearless series board
function loadSeries() {
  try { const s = JSON.parse(localStorage.getItem(SERIES_KEY)); if (s?.games?.length) return s; } catch { /* ignore */ }
  return { bestOf: 5, cur: 0, games: [{ usFirst: true, draft: [] }] };
}
let series = loadSeries();
const saveSeries = () => { try { localStorage.setItem(SERIES_KEY, JSON.stringify(series)); } catch { /* ignore */ } };
let query = '';

function champsSeen() {
  if (!index) return [];
  const s = new Set();
  for (const se of index.series) for (const g of se.games) for (const d of g.draft) if (d.champ) s.add(d.champ);
  return [...s];
}

function renderSeries() {
  const g = series.games[series.cur];
  const usName = usR?.name ?? 'Our team';
  const oppName = oppR?.name ?? 'Opponent';
  const prev = series.games.slice(0, series.cur).map((x) => ({ draft: x.draft.map((d) => ({ t: ORDER[d.i].t, champ: d.champ })) }));
  const locked = fearlessLocked(prev);
  const thisGame = new Set(g.draft.map((d) => d.champ));
  const champs = allChampions(champsSeen());
  const available = new Set(champs.filter((c) => !locked.has(c) && !thisGame.has(c)));
  const step = g.draft.length;
  const o = ORDER[step];
  const firstName = g.usFirst ? usName : oppName;
  const secondName = g.usFirst ? oppName : usName;
  const whoName = o ? (o.who === 'F' ? firstName : secondName) : null;
  const oppTurn = o && ((o.who === 'F') !== g.usFirst);
  const slot = (who, t) => {
    const idx = ORDER.filter((x) => x.who === who && x.t === t).map((x) => x.i);
    return idx.map((i) => { const d = g.draft.find((x) => x.i === i); return `<div class="slot${i === step ? ' now' : ''}">${d ? `${champTile(d.champ, { size: t === 'ban' ? 40 : 40 })}${t === 'pick' ? `<b>${esc(d.champ)}</b>` : ''}` : `<span class="muted small">${t === 'pick' ? `Pick ${idx.indexOf(i) + 1}` : ''}</span>`}</div>`; }).join('');
  };
  const oppPoolLeft = oppR ? oppR.picks.slice(0, 15).filter((p) => available.has(p.champ)) : [];
  const usPoolLeft = usR ? usR.picks.slice(0, 15).filter((p) => available.has(p.champ)) : [];
  let advice;
  if (!o) advice = '<p>Draft complete. Record the result and start the next game: every champion picked here is locked for the rest of the series.</p>';
  else if (!index) advice = '<p class="muted">Load the draft index to see predictions and suggestions.</p>';
  else if (oppTurn) {
    const side = o.who === 'F' ? 'first' : 'second';
    const p = predict(oppR, available, o.t, o.phase, side, 5);
    advice = `<h3>Likely ${o.t} from ${esc(oppName)}</h3><div class="pred">${p.map((x) => `<div>${champTile(x.champ, { size: 30 })}<b>${esc(x.champ)}</b><div class="bar" style="flex:1"><i style="width:${x.p}%"></i></div><span class="small">${x.p}%</span></div>`).join('') || '<p class="muted small">No history for this action among available champions.</p>'}</div><p class="muted small">From their ${o.t === 'ban' && o.phase === 1 ? `phase-1 bans as ${side === 'first' ? 'blue' : 'red'}` : `${o.t}s`} in ${oppR.games} games, renormalised over champions still available.</p>`;
  } else if (o.t === 'ban') {
    advice = `<h3>Suggested bans vs ${esc(oppName)}</h3>${suggestBans(oppR, available, 5).map((b) => `<div class="chip" style="margin:4px 0">${champTile(b.champ, { size: 28 })}<b>${esc(b.champ)}</b><span class="muted small">${esc(b.why)}</span></div>`).join('')}`;
  } else {
    advice = `<h3>Our comfort picks still open</h3><div class="pred">${predict(usR, available, 'pick', 1, 'first', 6).map((x) => `<div>${champTile(x.champ, { size: 30 })}<b>${esc(x.champ)}</b><span class="small muted">${x.n} games</span></div>`).join('')}</div>`;
  }
  const hot = new Set(oppTurn && index ? predict(oppR, available, o.t, o.phase, o.who === 'F' ? 'first' : 'second', 3).map((x) => x.champ) : []);
  const shown = champs.filter((c) => c.toLowerCase().includes(query.toLowerCase()));
  $('#series').innerHTML = `
  <div class="gtabs">
    ${series.games.map((x, i) => `<button data-g="${i}" class="${i === series.cur ? 'on' : ''}">Game ${i + 1}${x.winner ? ` · ${x.winner === 'us' ? 'W' : 'L'}` : ''}</button>`).join('')}
    <span class="muted small" style="align-self:center">Bo${series.bestOf} · Fearless: ${locked.size} champions locked</span>
    <button id="bo">Bo${series.bestOf === 5 ? 3 : 5}</button><button id="swap">Swap sides</button><button id="undo">Undo</button>
    <button id="won">We won</button><button id="lost">We lost</button><button id="next" class="primary">Next game</button>
    <button id="copy">Copy summary</button><button id="reset">New series</button>
  </div>
  <p class="step">${o ? `Step ${step + 1}/20: <span class="who ${o.who === 'F' ? 'blue' : 'red'}">${esc(whoName)}</span> ${o.t} (phase ${o.phase})` : 'Draft complete'}</p>
  <div class="board">
    <div class="side blue"><h3>${esc(firstName)} · blue</h3><div class="bans">${slot('F', 'ban')}</div><div class="slots">${slot('F', 'pick')}</div></div>
    <div class="side"><input id="q" type="search" placeholder="Search champions" value="${esc(query)}" style="width:100%">
      <div class="pool">${shown.map((c) => { const lockedC = locked.has(c); const used = thisGame.has(c); return `<button data-c="${esc(c)}" ${lockedC || used || !o ? 'disabled' : ''} class="${lockedC ? 'locked' : ''} ${hot.has(c) ? 'hot' : ''}">${champTile(c, { size: 44 })}<span>${esc(c)}</span></button>`; }).join('')}</div></div>
    <div class="side red"><h3>${esc(secondName)} · red</h3><div class="bans">${slot('S', 'ban')}</div><div class="slots">${slot('S', 'pick')}</div></div>
  </div>
  <div class="grid" style="margin-top:14px">
    <div class="card">${advice}</div>
    <div class="card"><h3>Fearless pools left</h3><p class="small"><b>${esc(oppName)}</b>: ${oppPoolLeft.length}/15 of their most-picked champions still available</p>${chipList(oppPoolLeft.slice(0, 10), (x) => x.n)}<p class="small" style="margin-top:12px"><b>${esc(usName)}</b>: ${usPoolLeft.length}/15 still available</p>${chipList(usPoolLeft.slice(0, 10), (x) => x.n)}</div>
    <div class="card"><h3>Locked for this series</h3>${locked.size ? `<div class="chips">${[...locked].map((c) => `<span class="chip">${champTile(c, { size: 24 })}${esc(c)}</span>`).join('')}</div>` : '<p class="muted small">Nothing yet: champions picked in earlier games appear here.</p>'}</div>
  </div>`;
  const q = $('#q');
  q.addEventListener('input', () => { query = q.value; renderSeries(); const n = $('#q'); n.focus(); n.setSelectionRange(query.length, query.length); });
  document.querySelectorAll('.pool button[data-c]').forEach((b) => b.addEventListener('click', () => { g.draft.push({ i: step, champ: b.dataset.c }); query = ''; saveSeries(); renderSeries(); }));
  document.querySelectorAll('.gtabs [data-g]').forEach((b) => b.addEventListener('click', () => { series.cur = Number(b.dataset.g); saveSeries(); renderSeries(); }));
  $('#undo').onclick = () => { g.draft.pop(); saveSeries(); renderSeries(); };
  $('#swap').onclick = () => { if (!g.draft.length || confirm('Swap sides and clear this game\'s draft?')) { g.usFirst = !g.usFirst; g.draft = []; saveSeries(); renderSeries(); } };
  $('#won').onclick = () => { g.winner = 'us'; saveSeries(); renderSeries(); };
  $('#lost').onclick = () => { g.winner = 'opp'; saveSeries(); renderSeries(); };
  $('#bo').onclick = () => { series.bestOf = series.bestOf === 5 ? 3 : 5; saveSeries(); renderSeries(); };
  $('#next').onclick = () => {
    if (series.games.length >= series.bestOf) return alert(`Best of ${series.bestOf}: no more games.`);
    // Loser of the previous game usually chooses side; default: swap.
    series.games.push({ usFirst: !g.usFirst, draft: [] });
    series.cur = series.games.length - 1;
    saveSeries(); renderSeries();
  };
  $('#reset').onclick = () => { if (confirm('Start a new series?')) { series = { bestOf: series.bestOf, cur: 0, games: [{ usFirst: true, draft: [] }] }; saveSeries(); renderSeries(); } };
  $('#copy').onclick = () => {
    const lines = series.games.map((x, i) => {
      const f = x.usFirst ? usName : oppName;
      const s = x.usFirst ? oppName : usName;
      const by = (who, t) => x.draft.filter((d) => ORDER[d.i].who === who && ORDER[d.i].t === t).map((d) => d.champ).join(', ');
      return `Game ${i + 1}${x.winner ? ` (${x.winner === 'us' ? 'won' : 'lost'})` : ''}\n  ${f} (blue) bans: ${by('F', 'ban')}\n  ${f} picks: ${by('F', 'pick')}\n  ${s} (red) bans: ${by('S', 'ban')}\n  ${s} picks: ${by('S', 'pick')}`;
    });
    navigator.clipboard?.writeText(`${usName} vs ${oppName}, Bo${series.bestOf} (Fearless)\n${lines.join('\n')}`);
    $('#copy').textContent = 'Copied';
  };
}

boot().catch((e) => { $('#dataStatus').textContent = `Could not start: ${e.message}`; });
