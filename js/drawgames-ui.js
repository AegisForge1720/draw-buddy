/* Draw Buddy preview: every NY draw game besides Quick Draw (no venues for these games).
 * Same features as Quick Draw: result replay ball drop, settings + next-draw countdown, 4 auto picks,
 * stats from real official history, hindsight check and log, and result notices for logged tickets.
 * Not official ticket validation: every graded amount says so (Ralph review 2026-11-16).
 * Wording rule: this is a result replay / draw animation. Results come from data.ny.gov once posted. */
(function () {
  'use strict';
  const E = window.DGEngine; if (!E) return;
  // Feature flags come from js/flags.js: all off on a public build; doublePlay + resultNotices on only for the private preview.
  const F = window.DB_FLAGS || {};
  const FLAGS = { doublePlay: !!F.doublePlay, resultNotices: !!F.resultNotices };
  const CP = window.DB_COPY || {};
  const DISCLAIMER = CP.D1 || "Past results don't predict future draws. Every draw is independent.";
  const RG = CP.RG || '18+. Gambling problem? Call 1-877-8-HOPENY or text HOPENY (467369).';
  const NA = CP.NA || 'Not affiliated with any lottery.';
  const NOT_OFFICIAL = CP.NOT_OFFICIAL || 'Not official ticket validation. Confirm prizes with the official lottery.';
  const DP_NOT_GRADED = 'Double Play results are not in the feed, so they are not graded.';
  const SAME_NOTE = 'These buttons can produce the same numbers. They are a lookback on posted results, not a forecast.';
  const LS_TICKETS = 'draw_buddy_dg_tickets', LS_GAME = 'draw_buddy_dg_last_game';
  const state = { game: null, rows: {}, loading: {}, pick: null, settings: {}, lookback: 'auto', busy: false, heatSel: null, modeCache: {} };
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => (n < 10 ? '0' + n : String(n));
  const money = v => v >= 1 ? '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) : (v * 100).toFixed(0) + '¢';
  const fmtDate = d => { if (!d) return ''; const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); };
  const fmtEt = ms => new Date(ms).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET';
  const sesLabel = s => s === 'midday' ? 'Midday' : s === 'evening' ? 'Evening' : '';
  const G = () => E.GAMES[state.game];

  // ---------- data (official rows only) ----------
  async function load(gk, force) {
    if (state.rows[gk] && !force) return state.rows[gk];
    if (state.loading[gk]) return state.loading[gk];
    const g = E.GAMES[gk];
    state.loading[gk] = (async () => {
      try {
        let q;
        if (g.table === 'ny_draw_history') q = supabaseClient.from('ny_draw_history').select('draw_key,draw_date,session,winning_numbers,bonus_number,booster').eq('game', gk).gte('draw_date', g.era).order('draw_key', { ascending: false }).limit(1000);
        else q = supabaseClient.from(g.table).select('draw_number,draw_date,winning_numbers,bonus_number,extra_multiplier').gte('draw_date', g.era).order('draw_date', { ascending: false }).limit(1000);
        const { data, error } = await q; if (error) throw error;
        const rows = (data || []).filter(x => Array.isArray(x.winning_numbers) && x.winning_numbers.length).map(x => ({ key: Number(x.draw_key ?? x.draw_number), date: String(x.draw_date).slice(0, 10), session: x.session || 'main', nums: x.winning_numbers.map(Number), bonus: x.bonus_number == null ? null : Number(x.bonus_number), mult: x.extra_multiplier == null ? null : Number(x.extra_multiplier), booster: x.booster == null ? null : Number(x.booster) }));
        state.rows[gk] = rows; return rows;
      } catch (e) { state.rows[gk] = null; return null; } finally { state.loading[gk] = null; }
    })();
    return state.loading[gk];
  }
  const rowsNow = () => state.rows[state.game] || [];
  const rowsForStats = () => { const s = state.settings[state.game] || {}; const r = rowsNow(); return (s.session && s.session !== 'any') ? r.filter(x => x.session === s.session) : r; };

  // ---------- settings ----------
  function defaults(gk) {
    const g = E.GAMES[gk];
    return { session: g.schedule.length > 1 ? 'any' : 'main', draws: 1, plays: g.minPlays || 1, powerplay: false, doubleplay: false, playType: 'straight', wager: g.kind === 'digits' ? 1 : g.price };
  }
  function S() { if (!state.settings[state.game]) state.settings[state.game] = defaults(state.game); return state.settings[state.game]; }
  function costPerDraw() {
    const g = G(), s = S();
    if (g.kind === 'digits') { const ds = (state.pick && state.pick.digits) || [1, 2, 3, 4].slice(0, g.digits); const pl = E.digitPlay(g.key, s.playType, ds, s.wager); return pl ? pl.cost : s.wager; }
    return g.price * s.plays + (s.powerplay ? s.plays : 0) + (s.doubleplay ? s.plays : 0);
  }
  function upcoming(n) {
    const g = G(), s = S(); const all = E.nextDraws(g, Date.now(), 60);
    return all.filter(d => s.session === 'any' || s.session === 'main' || d.session === s.session).slice(0, n || 1);
  }
  function secondsToNext() { const d = upcoming(1)[0]; return d ? Math.max(0, Math.round((d.at - Date.now()) / 1000)) : 0; }

  // ---------- render shell ----------
  function shell() {
    const panel = $('dg-panel'); if (!panel) return;
    panel.innerHTML = `
      <div class="bg-[#0b132b] p-3 rounded-xl border border-[#1d4ed8] shadow-xl space-y-1.5" id="dg-head">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0"><h2 id="dg-title" class="text-sm font-black text-yellow-400 uppercase tracking-wider"></h2>
          <div id="dg-format" class="text-[10px] text-cyan-300"></div></div>
          <div class="text-right shrink-0"><div class="text-[9px] uppercase tracking-wider text-blue-300">Next draw in</div><div id="dg-count" class="font-mono font-black text-cyan-300 text-lg leading-none">--:--</div></div>
        </div>
        <div id="dg-next" class="text-[10px] text-slate-200"></div>
        <div id="dg-data" class="text-[9px] text-slate-400"></div>
      </div>

      <div class="bg-[#050814] border-2 border-yellow-400/80 rounded-xl p-3 shadow-2xl space-y-2" id="dg-balldrop">
        <div class="flex items-center justify-between gap-2"><h3 class="text-[13px] font-black text-yellow-300">🎱 Ball Drop</h3><span id="dg-bd-mini" class="text-[10px] text-cyan-300 truncate"></span></div>
        <div id="dg-bd-sub" class="text-[10px] text-slate-400">Result replay of official NY Lottery results, once posted.</div>
        <div id="dg-bd-stage" class="relative rounded-lg bg-gradient-to-b from-[#0b132b] to-[#050814] border border-slate-700 min-h-[92px] p-2 overflow-hidden"></div>
        <div id="dg-bd-result" class="text-[11px] text-white leading-snug"></div>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" id="dg-bd-replay" class="bg-cyan-700 hover:bg-cyan-600 text-white font-black py-2 rounded-lg text-[11px]">▶ Replay latest result</button>
          <button type="button" id="dg-bd-reveal" class="bg-amber-600 hover:bg-amber-500 text-white font-black py-2 rounded-lg text-[11px]">▶ Reveal my pick</button>
        </div>
        <div id="dg-bd-note" class="text-[9px] text-slate-500"></div>
      </div>

      <div class="bg-[#0b132b] p-3 rounded-xl border border-[#1d4ed8] shadow-xl space-y-2">
        <h3 class="text-[11px] uppercase tracking-wider text-cyan-300 font-black">Auto Picks</h3>
        <div id="dg-auto-grid" class="grid grid-cols-2 gap-1.5"></div>
        <div id="dg-same-note" class="text-[9px] text-amber-200">${esc(SAME_NOTE)}</div>
        <div id="dg-auto-status" class="text-[9px] text-slate-300">Tap a button: it fills the settings and numbers below from the game's real history.</div>
        <div id="dg-ticket" class="bg-[#050814] p-3 rounded-xl border-2 border-yellow-400 space-y-2" hidden></div>
      </div>

      <div class="bg-[#0b132b] p-3 rounded-xl border border-[#1d4ed8] shadow-xl space-y-2" id="dg-settings">
        <h3 class="text-[11px] uppercase tracking-wider text-yellow-400 font-black">⚙️ Settings</h3>
        <div id="dg-settings-body" class="grid grid-cols-2 gap-2 text-[11px]"></div>
        <div id="dg-cost" class="text-[11px] font-bold text-emerald-300"></div>
        <div id="dg-options-note" class="text-[9px] text-slate-400 space-y-0.5"></div>
        <div class="border-t border-slate-800 pt-2 space-y-1.5">
          <div class="text-[10px] uppercase tracking-wider text-cyan-300 font-bold">✍️ My Numbers</div>
          <div class="flex gap-1.5"><input id="dg-own" type="text" inputmode="numeric" autocomplete="off" class="flex-1 min-w-0 bg-[#050814] border border-[#1d4ed8] rounded-lg p-2 text-base text-white focus:outline-none focus:border-yellow-400">
          <button type="button" id="dg-own-use" class="bg-[#1d4ed8] hover:bg-[#2563eb] text-white font-bold px-3 rounded-lg text-xs">Use</button></div>
          <div id="dg-own-msg" class="text-[9px] text-slate-400"></div>
        </div>
      </div>

      <div class="bg-[#0b132b] p-3 rounded-xl border border-[#1d4ed8] shadow-xl space-y-2" id="dg-stats">
        <div class="flex items-center justify-between gap-2"><h3 class="text-[11px] uppercase tracking-wider text-yellow-400 font-black">📊 Number Frequency</h3>
        <label class="text-[9px] text-slate-400 flex items-center gap-1">Lookback <select id="dg-lookback" class="bg-[#050814] border border-slate-700 rounded px-1 py-0.5 text-[10px] text-white"></select></label></div>
        <div id="dg-heat" class="grid gap-1"></div>
        <div id="dg-heat-bonus" class="space-y-1"></div>
        <div id="dg-inspect" class="text-[10px] text-cyan-200 bg-[#050814] border border-slate-700 rounded p-2" hidden></div>
        <div id="dg-hotcold" class="grid grid-cols-2 gap-2 text-[10px]"></div>
        <div id="dg-backtest" class="text-[10px] text-slate-300 space-y-1"></div>
      </div>

      <div class="bg-[#0b132b] p-3 rounded-xl border border-[#1d4ed8] shadow-xl space-y-2" id="dg-history">
        <h3 class="text-[11px] uppercase tracking-wider text-yellow-400 font-black">📜 Recent Official Results</h3>
        <div id="dg-history-list" class="space-y-1 max-h-[320px] overflow-y-auto"></div>
      </div>

      <div class="bg-[#0b132b] p-3 rounded-xl border border-[#1d4ed8] shadow-xl space-y-2" id="dg-log">
        <div class="flex items-center justify-between"><h3 class="text-[11px] uppercase tracking-wider text-yellow-400 font-black">📊 My Logged Tickets</h3>
        <button type="button" id="dg-log-clear" class="text-[9px] text-rose-300 border border-rose-800 rounded px-2 py-0.5">Clear</button></div>
        <div id="dg-notice" class="text-[10px] text-emerald-200 bg-emerald-950/40 border border-emerald-600/50 rounded-lg p-2" hidden></div>
        <div id="dg-log-list" class="space-y-1.5 text-[10px]"></div>
        <p class="text-[9px] text-slate-500">Saved on this device only. Compared with official results once they post to data.ny.gov (usually the morning after the draw). Fixed prize tiers only; Booster and Double Play are not included.</p>
        <p class="text-[9px] text-amber-200 font-bold">${esc(NOT_OFFICIAL)}</p>
      </div>

      <div class="text-center text-[10px] text-slate-400 space-y-1 px-2">
        <p>Draw Buddy is a fun stats companion, not a betting tool. ${esc(DISCLAIMER)}</p>
        <p class="font-bold text-yellow-300">${esc(RG)}</p>
        <p>${esc(NA)}</p>
      </div>`;
    $('dg-bd-replay').onclick = () => replayLatest();
    $('dg-bd-reveal').onclick = () => revealPick();
    $('dg-own-use').onclick = () => useOwn();
    $('dg-own').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); useOwn(); } });
    $('dg-log-clear').onclick = () => { if (confirm('Clear the logged tickets for this game?')) { saveTickets(tickets().filter(t => t.game !== state.game)); renderLog(); } };
    $('dg-lookback').onchange = e => { state.lookback = e.target.value; renderStats(); };
  }

  // ---------- header / countdown ----------
  function renderHead() {
    const g = G(), rows = rowsNow();
    $('dg-title').textContent = g.name;
    $('dg-format').textContent = g.kind === 'digits' ? `${g.digits} digits, 0–9 each · ${g.priceNote}` : `${g.pick} of 1–${g.max}${g.bonus ? (g.bonus.picked ? ` + ${g.bonus.name} 1–${g.bonus.max}` : ` + ${g.bonus.name} ball drawn`) : ''}${g.kind === 'keno' ? ` · ${g.drawn} drawn` : ''} · ${g.priceNote}`;
    const d = upcoming(1)[0];
    $('dg-next').innerHTML = d ? `Next: <b>${esc(fmtEt(d.at))}</b>${d.session !== 'main' ? ` (${sesLabel(d.session)})` : ''} · sales close ${esc(d.close)} · Schedule: ${esc(g.schedule.map(s => s.label).join(' · '))}` : '';
    $('dg-data').textContent = rows === null || state.rows[state.game] === null ? 'Data unavailable: official history did not load. Nothing is shown in its place.'
      : rows.length ? `${rows.length} official draws loaded (${g.eraNote}); newest ${fmtDate(rows[0].date)}${rows[0].session !== 'main' ? ' ' + sesLabel(rows[0].session) : ''}. Source: data.ny.gov.` : 'Loading official history…';
    const hd = $('header-next-draw'); if (hd && d) hd.textContent = new Date(d.at).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' });
    const hl = $('header-draw-label'); if (hl) hl.textContent = 'Next Draw';
    const hb = $('header-draw-box'); if (hb) hb.style.display = 'block';
  }
  function tick() {
    if (!active()) return;
    const s = secondsToNext(), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const txt = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h > 0 ? `${h}h ${pad(m)}m` : `${pad(m)}:${pad(sec)}`;
    const el = $('dg-count'); if (el) el.textContent = txt;
    if (s <= 1) setTimeout(renderHead, 1500);
  }

  // ---------- settings UI ----------
  function sel(id, label, opts, val) { return `<label class="space-y-0.5 block"><span class="block text-[9px] uppercase tracking-wider text-blue-300">${esc(label)}</span><select id="${id}" class="w-full bg-[#050814] border border-[#1d4ed8] rounded-lg p-1.5 text-white text-[11px]">${opts.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`; }
  function renderSettings() {
    const g = G(), s = S(), body = $('dg-settings-body'); let h = '';
    h += `<div class="col-span-2 text-[10px] text-slate-300">Numbers: ${g.kind === 'digits' ? `${g.digits} digits, each 0–9` : `pick ${g.pick} from 1–${g.max}`}${g.bonus && g.bonus.picked ? ` · ${esc(g.bonus.name)}: pick 1 from 1–${g.bonus.max}` : g.bonus ? ` · ${esc(g.bonus.name)} ball is drawn, not picked (counts with 5 matches)` : ''}${g.kind === 'keno' ? ` · ${g.drawn} numbers drawn` : ''}</div>`;
    if (g.schedule.length > 1) h += sel('dg-s-session', 'Draw', [['any', 'Next draw (either)'], ...g.schedule.map(x => [x.session, x.label])], s.session);
    if (g.kind === 'digits') {
      h += sel('dg-s-type', 'Play type', [['straight', 'Straight'], ['box', 'Box'], ['straightbox', 'Straight/Box ($1)'], ['combo', 'Combination'], ['frontpair', 'Front Pair'], ['backpair', 'Back Pair']], s.playType);
      h += sel('dg-s-wager', 'Wager', [[0.5, '50¢'], [1, '$1']], s.wager);
    }
    if (g.minPlays) h += sel('dg-s-plays', 'Plays per draw', [2, 4, 6, 8, 10].map(n => [n, `${n} plays ($${(n * g.price).toFixed(0)})`]), s.plays);
    const cap = E.drawCap(g, s.session); if (s.draws > cap) s.draws = cap;
    h += sel('dg-s-draws', `Draws in a row (app limit: ${cap}; official playslip may differ)`, Array.from({ length: cap }, (_, i) => [i + 1, String(i + 1)]), s.draws);
    if (g.key === 'powerball') {
      h += `<label class="flex items-center gap-1.5 text-[11px] text-white"><input type="checkbox" id="dg-s-pp" class="accent-cyan-500"${s.powerplay ? ' checked' : ''}> Power Play (+$1)</label>`;
      if (FLAGS.doublePlay) h += `<label class="flex items-center gap-1.5 text-[11px] text-white"><input type="checkbox" id="dg-s-dp" class="accent-cyan-500"${s.doubleplay ? ' checked' : ''}> Double Play (+$1)</label>`;
    }
    body.innerHTML = h;
    const on = (id, fn) => { const el = $(id); if (el) el.onchange = fn; };
    on('dg-s-session', e => { s.session = e.target.value; renderSettings(); renderHead(); renderStats(); renderAuto(); renderTicket(); });
    on('dg-s-type', e => { s.playType = e.target.value; if (s.playType === 'straightbox') s.wager = 1; renderSettings(); renderTicket(); });
    on('dg-s-wager', e => { s.wager = Number(e.target.value); renderCost(); renderTicket(); });
    on('dg-s-plays', e => { s.plays = Number(e.target.value); renderCost(); renderTicket(); });
    on('dg-s-draws', e => { s.draws = Number(e.target.value); renderCost(); renderTicket(); });
    on('dg-s-pp', e => { s.powerplay = e.target.checked; renderCost(); renderTicket(); });
    on('dg-s-dp', e => { s.doubleplay = e.target.checked; renderSettings(); renderTicket(); });
    $('dg-own').placeholder = g.kind === 'digits' ? `${g.digits} digits, e.g. ${'1234'.slice(0, g.digits)}` : `${g.pick} numbers 1–${g.max}${g.bonus && g.bonus.picked ? ` + ${g.bonus.name} (last)` : ''}`;
    const notes = [];
    g.options.forEach(o => { if (o.key !== 'doubleplay' || FLAGS.doublePlay) notes.push(`<div><b>${esc(o.label)}</b>: ${esc(o.note)}</div>`); });
    if (g.key === 'powerball' && s.doubleplay) notes.push(`<div class="text-amber-200 font-bold">${esc(DP_NOT_GRADED)}</div>`);
    if (g.builtInMultiplier) notes.push('<div>Every Mega Millions play includes a 2X, 3X, 4X, 5X or 10X multiplier on non-jackpot prizes, assigned at purchase and printed on the ticket. The feed has no per-ticket multiplier, so hindsight checks and the log use base prizes only. The fixed-prize return uses the official multiplier odds.</div>');
    if (g.kind === 'digits') notes.push('<div>Booster Ball is an occasional free NY promotion; history shows the boost percentage on draws where it ran. Hindsight check and log amounts do not include Booster. Instant Win (+$1) is decided at purchase and has no draw history, so Draw Buddy does not include it. Lucky Sum and Close Enough are not covered either. Wagers shown: 50¢ and $1.</div>');
    if (g.key === 'take5') notes.push('<div>Instant Win (+$1) is decided at purchase and has no draw history, so Draw Buddy does not include it. Take 5 prizes are pari-mutuel; match 2 wins a free Quick Pick.</div>');
    if (g.key === 'nylotto') notes.push('<div>Lotto prizes are pari-mutuel except match 3 ($1).</div>');
    if (g.key === 'pick10') notes.push('<div>Match 10 is $500,000 unless more than 10 tickets match all 10; then those winners share a $5,000,000 prize pool (9 NYCRR 5011.2).</div>');
    if (g.key === 'millionaire') notes.push('<div>Lifetime prizes: a top-prize winner chooses guaranteed annual payments (at least 20 years) or a discounted lump-sum cash payment. The top prize can be shared when there is more than one winner, so the amount can change (gaming.ny.gov, Feb 12, 2026). Draw Buddy does not show anyone a personal payout.</div>');
    if (g.official) notes.push(`<div>Draws in a row: app limit ${E.drawCap(g, s.session)}${g.maxDrawsOneSession ? ` (${g.maxDrawsOneSession} when you play one session = ${g.maxDrawsOneSession} days; ${g.maxDraws} when both = ${g.maxDraws / 2} days)` : ''}. Official multi-draw: up to ${g.official.n} consecutive ${g.official.unit} (${esc(g.official.src)}).</div>`);
    notes.push(`<div class="text-slate-500">Rules: ${esc(g.source)}.</div>`);
    $('dg-options-note').innerHTML = notes.join('');
    renderCost();
  }
  function renderCost() { const s = S(), c = costPerDraw(); $('dg-cost').textContent = `Ticket cost: ${money(c)} per draw × ${s.draws} draw${s.draws > 1 ? 's' : ''} = ${money(c * s.draws)}`; }

  // ---------- auto picks ----------
  function renderAuto() {
    const g = G(), mean = E.modeMeaning(g, FLAGS), grid = $('dg-auto-grid');
    const colors = { hits: 'bg-cyan-700', best: 'bg-emerald-700', one: 'bg-indigo-700', jackpot: 'bg-amber-600' };
    grid.innerHTML = ['hits', 'best', 'one', 'jackpot'].map(m => `<button type="button" data-dgmode="${m}" class="dg-auto-btn text-white font-black py-2 px-1.5 rounded-lg text-[11px] leading-tight min-h-[54px] border-2 border-transparent ${colors[m]}">${esc(E.MODE_NAMES[m])}<span class="block text-[8.5px] font-normal opacity-85 mt-0.5">${esc(mean[m])}</span><span data-dgsame="${m}" class="block text-[8.5px] font-bold text-yellow-200 mt-0.5" hidden></span></button>`).join('');
    grid.querySelectorAll('[data-dgmode]').forEach(b => b.onclick = () => runMode(b.dataset.dgmode));
    markSame();
  }
  // All four buttons on the current rows (cached per game + session), so identical tickets can be labeled.
  function modePicks() {
    const g = G(), s = S(), R = rowsForStats(); if (!R.length) return null;
    const k = `${g.key}|${s.session}|${g.kind === 'digits' ? s.wager : ''}|${R.length}|${R[0].date}|${R[0].session}`;
    if (!state.modeCache[k]) { const o = {}; ['hits', 'best', 'one', 'jackpot'].forEach(m => { o[m] = g.kind === 'digits' ? E.pickDigits(g.key, R, m, m === 'jackpot' ? 1 : s.wager, s.session) : E.pickLotto(g, R, m, s.session, FLAGS); }); state.modeCache = { [k]: o }; }
    return state.modeCache[k];
  }
  const numsKey = pk => pk && !pk.error ? JSON.stringify(pk.digits ? [pk.digits, pk.playType] : [pk.nums, pk.bonus]) : null;
  const addOnKey = pk => pk && pk.opts ? `${!!pk.opts.powerplay}|${!!(FLAGS.doublePlay && pk.opts.doubleplay)}` : (pk && pk.wager != null ? String(pk.wager) : '');
  // Other modes whose ticket has the same numbers (and bonus / play type) as `pk`.
  function sameAs(pk, selfMode) {
    const all = modePicks(); if (!all || !pk) return [];
    const key = numsKey(pk); if (!key) return [];
    return ['hits', 'best', 'one', 'jackpot'].filter(m => m !== selfMode && numsKey(all[m]) === key).map(m => ({ m, name: E.MODE_NAMES[m], addOnsDiffer: addOnKey(all[m]) !== addOnKey(pk) }));
  }
  const sameText = list => list.length ? `Same numbers as ${list.map(x => x.name + (x.addOnsDiffer ? ' (different add-ons)' : '')).join(' and ')}` : '';
  function markSame() {
    const all = modePicks();
    document.querySelectorAll('#dg-auto-grid [data-dgsame]').forEach(el => { const m = el.dataset.dgsame, t = all ? sameText(sameAs(all[m], m)) : ''; el.textContent = t ? '= ' + t : ''; el.hidden = !t; });
  }
  async function runMode(mode) {
    const g = G(), st = $('dg-auto-status');
    st.textContent = 'Backtesting on real history…';
    const rows = await load(state.game); if (!rows) { st.textContent = 'Data unavailable: official history did not load.'; return; }
    const R = rowsForStats();
    const s = S();
    const pk = g.kind === 'digits' ? E.pickDigits(g.key, R, mode, mode === 'jackpot' ? 1 : s.wager, s.session) : E.pickLotto(g, R, mode, s.session, FLAGS);
    if (pk.error) { st.textContent = pk.error; return; }
    // Fill settings exactly like Quick Draw's buttons fill Wager & Games.
    s.draws = pk.draws;
    if (g.kind === 'digits') { s.playType = pk.playType; s.wager = pk.wager; }
    if (g.key === 'powerball') { s.powerplay = pk.opts.powerplay; s.doubleplay = FLAGS.doublePlay && pk.opts.doubleplay; }
    state.pick = { ...pk, source: 'auto' };
    document.querySelectorAll('.dg-auto-btn').forEach(b => b.style.borderColor = b.dataset.dgmode === mode ? '#facc15' : 'transparent');
    renderSettings(); renderTicket();
    st.textContent = `${pk.name}: from ${R.length} official draws${s.session !== 'any' && s.session !== 'main' ? ' (' + sesLabel(s.session) + ' only)' : ''}. Lookback ${pk.lookback} draws chosen by backtest.`;
  }
  function useOwn() {
    const g = G(), raw = ($('dg-own').value || '').trim(), msg = $('dg-own-msg');
    if (g.kind === 'digits') {
      const ds = raw.replace(/\D/g, '').split('').map(Number);
      if (ds.length !== g.digits) { msg.textContent = `Enter exactly ${g.digits} digits.`; return; }
      const s = S(); if (!E.digitPlay(g.key, s.playType, ds, s.wager)) { msg.textContent = 'That play type needs at least two different digits.'; return; }
      state.pick = { name: '✍️ My Numbers', digits: ds, playType: s.playType, wager: s.wager, why: ['Your own digits.'], source: 'own' };
    } else {
      const n = raw.split(/[^0-9]+/).filter(Boolean).map(Number), need = g.pick + (g.bonus && g.bonus.picked ? 1 : 0);
      if (n.length !== need) { msg.textContent = `Enter ${g.pick} numbers${g.bonus && g.bonus.picked ? ` and the ${g.bonus.name} last` : ''}.`; return; }
      const main = n.slice(0, g.pick), b = g.bonus && g.bonus.picked ? n[g.pick] : null;
      if (new Set(main).size !== g.pick || main.some(x => x < 1 || x > g.max)) { msg.textContent = `Main numbers must be ${g.pick} different numbers from 1 to ${g.max}.`; return; }
      if (b != null && (b < 1 || b > g.bonus.max)) { msg.textContent = `${g.bonus.name} must be 1 to ${g.bonus.max}.`; return; }
      state.pick = { name: '✍️ My Numbers', nums: main.sort((x, y) => x - y), bonus: b, opts: { powerplay: S().powerplay, doubleplay: S().doubleplay }, why: ['Your own numbers.'], source: 'own' };
    }
    msg.textContent = 'Loaded into Your Ticket below. Check it against history there.';
    renderTicket();
  }

  // ---------- your ticket ----------
  function ballHtml(n, cls) { return `<span class="inline-flex items-center justify-center w-8 h-8 rounded-full text-[12px] font-black ${cls}">${n}</span>`; }
  function ticketBalls(pk, g) {
    if (g.kind === 'digits') {
      const pair = pk.playType === 'frontpair' ? [0, 1] : pk.playType === 'backpair' ? [g.digits - 2, g.digits - 1] : null;
      return pk.digits.map((d, i) => pair && !pair.includes(i) ? ballHtml('×', 'bg-slate-800 text-slate-500 border border-slate-600') : ballHtml(d, 'bg-yellow-400 text-black')).join('');
    }
    return pk.nums.map(n => ballHtml(pad(n), 'bg-yellow-400 text-black')).join('') + (pk.bonus != null ? ballHtml(pad(pk.bonus), 'bg-red-600 text-white border border-red-300') : '');
  }
  function historyCheck(pk, g) {
    const R = rowsForStats(), N = Math.min(R.length, 100); if (!N) return '';
    let won = 0, cash = 0; const tiers = {};
    const t = g.kind === 'digits' ? { playType: S().playType, digits: pk.digits, wager: S().wager } : { nums: pk.nums, bonus: pk.bonus, opts: { powerplay: S().powerplay } };
    for (let i = 0; i < N; i++) { const gr = E.grade(g, t, R[i]); if (!gr) continue; if (gr.won) won++; cash += gr.cash || 0; if (g.kind !== 'digits') tiers[gr.key] = (tiers[gr.key] || 0) + 1; }
    const tierTxt = g.kind !== 'digits' ? Object.keys(tiers).sort((a, b) => parseFloat(b) - parseFloat(a) || (b.endsWith('b') - a.endsWith('b'))).slice(0, 5).map(k => `${k.replace('b', '+' + (g.bonus ? g.bonus.name.split(' ')[0] : 'B'))}: ${tiers[k]}`).join(' · ') : '';
    const s = S(), dp = g.key === 'powerball' && s.doubleplay, spent = (costPerDraw() - (dp ? s.plays : 0)) * N;
    const notes = [];
    if (g.builtInMultiplier) notes.push('Base prizes only: each Mega Millions play has its own 2X–10X multiplier printed on the ticket, and the feed does not have it.');
    if (g.kind === 'digits') notes.push('Booster is not included.');
    if (dp) notes.push(`${DP_NOT_GRADED} Spend excludes the Double Play $1.`);
    return `<div id="dg-hindsight" class="text-[10px] text-slate-200 border-t border-slate-700 pt-1.5"><b>Hindsight check:</b> on the last ${N} official draws this ticket matched a prize tier on ${won} draw${won === 1 ? '' : 's'}${cash ? `, ${money(cash)} in fixed prize tiers vs ${money(spent)} spent` : ''}.${tierTxt ? `<div class="text-[9px] text-slate-400">Matches: ${esc(tierTxt)}</div>` : ''}${notes.length ? `<div class="text-[9px] text-slate-400">${esc(notes.join(' '))}</div>` : ''}<div class="text-[9px] text-slate-500">Hindsight only${state.pick && state.pick.source === 'auto' ? ': the auto picks were chosen from these same draws' : ': a lookback on draws that already happened'}. It does not improve the chance of a future prize.</div><div class="text-[9px] text-amber-200 font-bold">${esc(NOT_OFFICIAL)}</div></div>`;
  }
  function renderTicket() {
    const box = $('dg-ticket'), pk = state.pick, g = G(); if (!pk) { box.hidden = true; return; }
    const s = S(), cost = costPerDraw(), next = upcoming(s.draws);
    let oddsTxt = '';
    if (g.kind === 'digits') { const pl = E.digitPlay(g.key, s.playType, pk.digits, s.wager); if (pl) oddsTxt = `${pl.label}: odds 1 in ${Math.round(1 / pl.pWin).toLocaleString()}, top prize ${money(pl.top)}; official return ${(E.digitReturnPer$(g.key, s.playType, pk.digits, s.wager) * 100).toFixed(0)}¢ per $1.`; else oddsTxt = 'That play type is not offered for these digits.'; }
    else { const fr = E.fixedReturn(g, { powerplay: s.powerplay, doubleplay: s.doubleplay }); oddsTxt = `Odds of any prize: 1 in ${(1 / fr.pAny / (g.minPlays ? 1 : 1)).toFixed(2)} per play · fixed-prize return ${(fr.perDollar * 100).toFixed(1)}¢ per $1 (jackpots${g.key === 'millionaire' ? ', lifetime prizes' : ''}${['nylotto', 'take5'].includes(g.key) ? ' and pari-mutuel prizes' : ''} not counted)${s.powerplay ? '. Power Play return assumes the multiplier table where 10X is available (advertised jackpot $150 million or less)' : ''}${g.builtInMultiplier ? '. Includes the average built-in multiplier' : ''}${g.key === 'pick10' ? '. Uses $500,000 for match 10 (it can be a share of $5,000,000 when more than 10 tickets match)' : ''}.`; }
    const same = state.pick.source === 'auto' ? sameText(sameAs(pk, pk.mode)) : sameText(sameAs(pk, null));
    box.hidden = false;
    box.innerHTML = `
      <div class="flex items-start justify-between gap-2"><div><div class="text-[10px] uppercase tracking-wider text-yellow-300 font-black">🎟️ Your Ticket</div><div class="text-[11px] font-black text-white">${esc(pk.name)}</div></div>
      <div class="text-right"><div class="text-[9px] text-blue-300">${esc(g.kind === 'digits' ? (E.digitPlay(g.key, s.playType, pk.digits, s.wager) || {}).label || '' : g.name)}${s.powerplay ? ' + Power Play' : ''}${s.doubleplay ? ' + Double Play' : ''}${g.minPlays ? ` · ${s.plays} plays` : ''}</div><div class="text-[12px] font-black text-emerald-400">${money(cost * s.draws)}</div></div></div>
      <div class="flex flex-wrap gap-1">${ticketBalls(pk, g)}</div>
      ${same ? `<div id="dg-same-ticket" class="text-[10px] font-bold text-yellow-200">${esc(same)}.</div>` : ''}
      ${g.minPlays && s.plays > 1 ? `<div class="text-[9px] text-slate-400">Lotto is sold two plays for $1: this pick is play 1; add your own numbers for the other play${s.plays > 2 ? 's' : ''}.</div>` : ''}
      <div class="text-[10px] font-bold text-white">${next.length ? `${next.length > 1 ? 'Draws' : 'Draw'}: ${esc(fmtEt(next[0].at))}${next.length > 1 ? ' → ' + esc(fmtEt(next[next.length - 1].at)) : ''} (${s.draws} draw${s.draws > 1 ? 's' : ''})` : ''}</div>
      <div class="text-[9px] text-cyan-300 leading-snug">${(pk.why || []).map(esc).join('<br>')}</div>
      <div class="text-[9px] text-slate-300">${esc(oddsTxt)}</div>
      ${historyCheck(pk, g)}
      <div class="text-[9px] text-yellow-300 font-bold">${esc(DISCLAIMER)}</div>
      <div class="grid grid-cols-2 gap-2"><button type="button" id="dg-t-reveal" class="bg-amber-700 hover:bg-amber-600 text-white font-bold py-2 rounded-lg text-[11px]">🎱 Reveal in Ball Drop</button>
      <button type="button" id="dg-t-log" class="bg-gradient-to-r from-emerald-500 to-green-600 text-slate-950 font-black py-2 rounded-lg text-[11px]">📥 Log Ticket</button></div>`;
    $('dg-t-reveal').onclick = () => { revealPick(); $('dg-balldrop').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    $('dg-t-log').onclick = () => logTicket();
  }

  // ---------- log / grade / notices ----------
  function tickets() { try { const a = JSON.parse(localStorage.getItem(LS_TICKETS) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function saveTickets(a) { try { localStorage.setItem(LS_TICKETS, JSON.stringify(a.slice(-300))); } catch (e) {} }
  function logTicket() {
    const g = G(), pk = state.pick, s = S(); if (!pk) return;
    const draws = upcoming(s.draws).map(d => ({ date: d.date, session: d.session, at: d.at }));
    const t = { id: Date.now(), game: g.key, name: pk.name, at: Date.now(), draws, cost: costPerDraw() * s.draws,
      nums: pk.nums || null, bonus: pk.bonus ?? null, digits: pk.digits || null, playType: g.kind === 'digits' ? s.playType : null, wager: s.wager, opts: { powerplay: s.powerplay, doubleplay: s.doubleplay }, plays: s.plays, results: {} };
    const a = tickets(); a.push(t); saveTickets(a);
    $('dg-auto-status').textContent = `✅ Logged for ${draws.length} draw${draws.length > 1 ? 's' : ''} starting ${fmtEt(draws[0].at)}. It is graded once official results post.`;
    renderLog(); $('dg-log').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function gradeAll(gk) {
    const g = E.GAMES[gk], rows = state.rows[gk] || []; const byKey = {}; rows.forEach(r => byKey[r.date + '|' + r.session] = r);
    const a = tickets(); const fresh = [];
    a.forEach(t => { if (t.game !== gk) return; t.draws.forEach(d => { const k = d.date + '|' + d.session, r = byKey[k]; if (r && !t.results[k]) { const gr = E.grade(g, { nums: t.nums, bonus: t.bonus, digits: t.digits, playType: t.playType, wager: t.wager, opts: t.opts }, r); t.results[k] = { text: gr ? gr.text : 'n/a', cash: gr ? gr.cash || 0 : 0, won: gr ? !!gr.won : false }; fresh.push({ t, r, gr }); } }); });
    if (fresh.length) saveTickets(a);
    return fresh;
  }
  function renderLog() {
    const g = G(), list = $('dg-log-list'), mine = tickets().filter(t => t.game === state.game).sort((a, b) => b.at - a.at);
    if (!mine.length) { list.innerHTML = '<div class="text-slate-400">No tickets logged for this game yet. Tap 📥 Log Ticket on a pick.</div>'; return; }
    list.innerHTML = mine.slice(0, 20).map(t => {
      const done = t.draws.filter(d => t.results[d.date + '|' + d.session]).length, won = Object.values(t.results).reduce((s, x) => s + (x.cash || 0), 0);
      const nums = t.digits ? t.digits.join('') + ' · ' + ((E.digitPlay(g.key, t.playType, t.digits, t.wager) || {}).label || t.playType) : t.nums.map(pad).join(' ') + (t.bonus != null ? ' + ' + pad(t.bonus) : '');
      const res = t.draws.map(d => { const r = t.results[d.date + '|' + d.session]; return `<div class="flex justify-between gap-2"><span class="text-slate-400">${esc(fmtDate(d.date))}${d.session !== 'main' ? ' ' + sesLabel(d.session) : ''}</span><span class="${r ? (r.won ? 'text-emerald-300 font-bold' : 'text-slate-300') : 'text-slate-500'}">${r ? esc(r.text) : 'waiting for the official result'}</span></div>`; }).join('');
      return `<div class="bg-[#050814] border border-slate-700 rounded-lg p-2 space-y-1"><div class="flex justify-between gap-2"><b class="text-white truncate">${esc(t.name)}</b><span class="text-slate-400 shrink-0">${money(t.cost)} · ${done}/${t.draws.length} graded${won ? ` · <span class="text-emerald-300">${money(won)} in prize tiers</span>` : ''}</span></div><div class="font-mono text-yellow-300">${esc(nums)}</div>${res}${t.opts && t.opts.doubleplay ? `<div class="text-[9px] text-amber-200">${esc(DP_NOT_GRADED)}</div>` : ''}<button type="button" data-dgdel="${t.id}" class="text-[9px] text-rose-300 underline">Remove</button></div>`;
    }).join('');
    list.querySelectorAll('[data-dgdel]').forEach(b => b.onclick = () => { saveTickets(tickets().filter(t => String(t.id) !== b.dataset.dgdel)); renderLog(); });
  }
  async function checkNotices(fromTimer) {
    if (!FLAGS.resultNotices) return;
    const gks = [...new Set(tickets().filter(t => t.draws.some(d => !t.results[d.date + '|' + d.session] && d.at < Date.now())).map(t => t.game))];
    for (const gk of gks) {
      await load(gk, fromTimer); const fresh = gradeAll(gk); if (!fresh.length) continue;
      if (gk === state.game && active()) {
        const f = fresh[0], n = $('dg-notice');
        n.hidden = false; n.textContent = `🔔 A data.ny.gov ${E.GAMES[gk].name} result posted for ${fmtDate(f.r.date)}${f.r.session !== 'main' ? ' ' + sesLabel(f.r.session) : ''}. On-device comparison for ${f.t.name}: ${f.gr ? f.gr.text : ''}. ${NOT_OFFICIAL} Replaying it in the Ball Drop.`;
        renderLog(); animate(f.r, { kind: 'result', ticket: f.t });
      }
    }
  }

  // ---------- stats ----------
  function lookbackN() { const R = rowsForStats(); if (state.lookback === 'all') return R.length; const n = parseInt(state.lookback, 10); return Number.isFinite(n) ? Math.min(n, R.length) : Math.min(state.pick && state.pick.lookback ? state.pick.lookback : 100, R.length); }
  function heatColor(v, exp) { const r = exp ? v / exp : 0; return r >= 1.6 ? 'bg-red-600 text-white' : r >= 1.25 ? 'bg-orange-500 text-black' : r >= 0.9 ? 'bg-yellow-400 text-black' : r >= 0.6 ? 'bg-blue-800 text-blue-100' : 'bg-[#111c38] text-blue-300'; }
  function renderStats() {
    const g = G(), R = rowsForStats(), lb = $('dg-lookback');
    const opts = [['auto', 'Pick\'s window'], ['20', '20'], ['50', '50'], ['100', '100'], ['300', '300'], ['all', `All (${R.length})`]];
    lb.innerHTML = opts.map(([v, t]) => `<option value="${v}"${v === state.lookback ? ' selected' : ''}>${t}</option>`).join('');
    const N = lookbackN(), heat = $('dg-heat'), hb = $('dg-heat-bonus'), hc = $('dg-hotcold'), bt = $('dg-backtest');
    if (!R.length) { heat.innerHTML = '<div class="text-[10px] text-slate-400">No official history loaded.</div>'; hb.innerHTML = ''; hc.innerHTML = ''; bt.innerHTML = ''; return; }
    if (g.kind === 'digits') {
      heat.style.gridTemplateColumns = 'auto repeat(10, minmax(0, 1fr))';
      const exp = N / 10; let h = '<div></div>' + Array.from({ length: 10 }, (_, d) => `<div class="text-center text-[9px] text-blue-300">${d}</div>`).join('');
      for (let pos = 0; pos < g.digits; pos++) {
        const c = new Array(10).fill(0); R.slice(0, N).forEach(r => c[r.nums[pos]]++);
        h += `<div class="text-[9px] text-blue-300 pr-1 self-center">Digit ${pos + 1}</div>` + c.map((v, d) => `<button type="button" data-pos="${pos}" data-d="${d}" class="dg-hcell rounded text-[10px] font-bold py-1 ${heatColor(v, exp)}">${v}</button>`).join('');
      }
      heat.innerHTML = h; hb.innerHTML = `<div class="text-[9px] text-slate-400">Times each digit was drawn in each position, last ${N} draws (chance average ${exp.toFixed(1)}).</div>`;
      heat.querySelectorAll('.dg-hcell').forEach(b => b.onclick = () => { const pos = +b.dataset.pos, d = +b.dataset.d; let gap = R.findIndex(r => r.nums[pos] === d); const ins = $('dg-inspect'); ins.hidden = false; ins.textContent = `Digit ${d} in position ${pos + 1}: ${b.textContent} times in the last ${N} draws (chance average ${(N / 10).toFixed(1)}); last seen ${gap < 0 ? 'not in the loaded history' : gap === 0 ? 'in the newest draw' : gap + ' draws ago'}. ${DISCLAIMER}`; });
      const sums = {}; R.slice(0, N).forEach(r => { const s = r.nums.reduce((a, b) => a + b, 0); sums[s] = (sums[s] || 0) + 1; });
      const pairs = {}; R.slice(0, N).forEach(r => { const k = r.nums.slice(0, 2).join(''); pairs[k] = (pairs[k] || 0) + 1; });
      const topPairs = Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const boosters = R.slice(0, N).filter(r => r.booster != null);
      hc.innerHTML = `<div><div class="font-bold text-orange-300">Most common front pairs</div>${topPairs.map(([k, v]) => `${k}: ${v}`).join(' · ')}</div><div><div class="font-bold text-cyan-300">Most common digit sums</div>${Object.entries(sums).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div>${boosters.length ? `<div class="col-span-2 text-slate-400">Booster Ball ran on ${boosters.length} of these draws.</div>` : ''}`;
    } else {
      const f = E.freq(R, N, 1, g.max), exp = N * g.drawn / g.max, cols = g.max > 60 ? 10 : g.max > 39 ? 10 : 8;
      heat.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      heat.innerHTML = Object.keys(f).map(Number).map(n => `<button type="button" data-n="${n}" class="dg-hcell aspect-square rounded text-[10px] font-black flex flex-col items-center justify-center leading-none ${heatColor(f[n], exp)}${state.pick && state.pick.nums && state.pick.nums.includes(n) ? ' ring-2 ring-white' : ''}">${n}<span class="text-[7px] font-normal opacity-80">${f[n]}</span></button>`).join('');
      heat.querySelectorAll('.dg-hcell').forEach(b => b.onclick = () => { const n = +b.dataset.n, gap = R.findIndex(r => r.nums.includes(n)); const ins = $('dg-inspect'); ins.hidden = false; ins.textContent = `${n}: drawn ${f[n]} times in the last ${N} draws (chance average ${exp.toFixed(1)}); last seen ${gap < 0 ? 'not in the loaded history' : gap === 0 ? 'in the newest draw' : gap + ' draws ago'}. ${DISCLAIMER}`; });
      if (g.bonus && g.bonus.picked) {
        const fb = E.freq(R, N, 1, g.bonus.max, true), eb = N / g.bonus.max;
        hb.innerHTML = `<div class="text-[10px] font-bold text-red-300">${esc(g.bonus.name)} (last ${N} draws, chance average ${eb.toFixed(1)})</div><div class="grid gap-1" style="grid-template-columns:repeat(${Math.min(13, g.bonus.max)},minmax(0,1fr))">${Object.keys(fb).map(Number).map(n => `<div class="aspect-square rounded text-[9px] font-black flex flex-col items-center justify-center leading-none ${heatColor(fb[n], eb)}${state.pick && state.pick.bonus === n ? ' ring-2 ring-white' : ''}">${n}<span class="text-[7px] font-normal opacity-80">${fb[n]}</span></div>`).join('')}</div>`;
      } else hb.innerHTML = `<div class="text-[9px] text-slate-400">Number = times drawn in the last ${N} draws (chance average ${exp.toFixed(1)}). Red = well above average, blue = below.</div>`;
      const hot = Object.keys(f).map(Number).sort((a, b) => f[b] - f[a] || a - b).slice(0, 10), od = E.overdue(R, N, 10, 1, g.max);
      hc.innerHTML = `<div><div class="font-bold text-orange-300">Most drawn (last ${N})</div>${hot.map(n => `${n} (${f[n]})`).join(' · ')}</div><div><div class="font-bold text-cyan-300">🧊 Overdue</div>${od.nums.map(n => `${n} (${od.gaps[od.nums.indexOf(n)] ?? ''})`).join(' · ')}</div>`;
      // overdue gaps are listed in gap order; show number with its gap
      const odPairs = (() => { const slice = R.slice(0, N); return od.nums.map(n => { const i = slice.findIndex(r => r.nums.includes(n)); return `${n} (${i < 0 ? N + '+' : i})`; }); })();
      hc.lastElementChild.innerHTML = `<div class="font-bold text-cyan-300">🧊 Overdue (draws since seen)</div>${odPairs.join(' · ')}`;
    }
    // Backtest summary of all 4 buttons on the current data (honest: hindsight on real draws).
    const mp = modePicks() || {}, modes = ['hits', 'best', 'one', 'jackpot'].map(m => [m, mp[m] || { error: 'No official history loaded.' }]);
    bt.innerHTML = `<div class="font-bold text-yellow-300 text-[10px]">🧪 Backtest of the 4 auto picks (newest ${E.BT} draws)</div>` + modes.map(([m, pk]) => pk.error ? `<div>${esc(E.MODE_NAMES[m])}: ${esc(pk.error)}</div>` :
      `<div>${esc(E.MODE_NAMES[m])}: window ${pk.lookback} · ${g.kind === 'digits' ? `$${pk.backtest.per$.toFixed(2)} in prize tiers per $1, a prize tier on ${(pk.backtest.winRate * 100).toFixed(1)}% of draws` : `avg ${pk.backtest.avgHits.toFixed(2)} matches vs ${pk.backtest.exp.toFixed(2)} chance, a prize tier on ${(pk.backtest.prizeRate * 100).toFixed(0)}% of draws`}${(() => { const t = sameText(sameAs(pk, m)); return t ? ` · ${esc(t)}` : ''; })()}</div>`).join('') + `<div class="text-[9px] text-slate-500">${esc(SAME_NOTE)} ${esc(DISCLAIMER)}</div>`;
  }

  // ---------- history ----------
  function renderHistory() {
    const g = G(), R = rowsNow().slice(0, 30), el = $('dg-history-list');
    if (!R.length) { el.innerHTML = '<div class="text-[10px] text-slate-400">No official results loaded.</div>'; return; }
    el.innerHTML = R.map((r, i) => {
      const balls = g.kind === 'digits' ? r.nums.map(d => `<span class="inline-flex w-6 h-6 rounded-full bg-blue-500 text-white text-[11px] font-black items-center justify-center">${d}</span>`).join('')
        : r.nums.map(n => `<span class="inline-flex w-6 h-6 rounded-full bg-blue-500 text-white text-[10px] font-black items-center justify-center">${n}</span>`).join('') + (r.bonus != null ? `<span class="inline-flex w-6 h-6 rounded-full bg-red-600 text-white text-[10px] font-black items-center justify-center" title="${esc(g.bonus ? g.bonus.name : 'Bonus')}">${r.bonus}</span>` : '');
      const extra = [r.mult ? `${r.mult}X` : '', r.booster ? `Booster ${r.booster}%` : ''].filter(Boolean).join(' · ');
      return `<div class="flex items-center justify-between gap-2 bg-[#050814] rounded px-2 py-1"><div class="min-w-0"><div class="text-[9px] text-slate-400">${esc(fmtDate(r.date))}${r.session !== 'main' ? ' · ' + sesLabel(r.session) : ''}${extra ? ' · ' + esc(extra) : ''}</div><div class="flex flex-wrap gap-0.5">${balls}</div></div><button type="button" data-dgrep="${i}" class="text-[9px] text-cyan-300 underline shrink-0">Replay</button></div>`;
    }).join('');
    el.querySelectorAll('[data-dgrep]').forEach(b => b.onclick = () => { animate(R[+b.dataset.dgrep], { kind: 'result' }); $('dg-balldrop').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }

  // ---------- ball drop (result replay / pick reveal) ----------
  let animToken = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const BALL_MS = 900, reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function ballEl(txt, kind, size) { const d = document.createElement('div'); d.className = 'dg-ball ' + kind; d.textContent = txt; if (size) { d.style.width = d.style.height = size + 'px'; d.style.fontSize = Math.round(size * 0.42) + 'px'; } return d; }
  async function animate(row, how) {
    const g = G(), stage = $('dg-bd-stage'), res = $('dg-bd-result'), mini = $('dg-bd-mini'), sub = $('dg-bd-sub'), note = $('dg-bd-note');
    const my = how.ticket || (how.kind === 'result' ? state.pick : null), token = ++animToken;
    stage.innerHTML = ''; res.textContent = '';
    const isPick = how.kind === 'pick';
    sub.textContent = isPick ? `Pick reveal: your ${how.label || 'ticket'} drops one ball at a time. This is not a draw.` : `Result replay · official result for ${fmtDate(row.date)}${row.session !== 'main' ? ' ' + sesLabel(row.session) : ''} (data.ny.gov)${row.mult ? ` · multiplier ${row.mult}X` : ''}${row.booster ? ` · Booster ${row.booster}%` : ''}`;
    note.textContent = isPick ? '' : g.kind === 'digits' ? 'Digits drop in the order drawn.' : 'data.ny.gov lists the numbers low to high, so the balls drop low to high (the order they came out of the machine is not in the feed).';
    const wait = reduced() ? 60 : BALL_MS;
    if (g.kind === 'keno') {
      // 1–80 grid like Quick Draw's ball drop
      const grid = document.createElement('div'); grid.className = 'bd-grid'; let cells = ''; for (let n = 1; n <= 80; n++) cells += `<div class="bd-cell${my && my.nums && my.nums.includes(n) && !isPick ? ' dg-mine' : ''}" data-n="${n}">${n}</div>`; grid.innerHTML = cells; stage.appendChild(grid);
      const seq = isPick ? row.nums : row.nums; let hits = 0, prev = null;
      for (let i = 0; i < seq.length; i++) {
        if (token !== animToken) return; const n = seq[i], c = grid.querySelector(`[data-n="${n}"]`), hit = !isPick && my && my.nums && my.nums.includes(n);
        if (prev) prev.classList.remove('bd-now'); if (c) { c.classList.add('bd-lit', 'bd-now'); if (hit || isPick) c.classList.add('bd-win'); prev = c; }
        if (hit) hits++; mini.textContent = `Ball ${i + 1} of ${seq.length}${my && !isPick ? ` · ${hits} match${hits === 1 ? '' : 'es'}` : ''}`;
        await sleep(isPick ? wait / 2 : wait);
      }
      if (prev) prev.classList.remove('bd-now');
    } else {
      const tray = document.createElement('div'); tray.className = 'flex flex-wrap items-end justify-center gap-1.5 min-h-[64px] pt-4'; stage.appendChild(tray);
      const tube = document.createElement('div'); tube.className = 'absolute left-1/2 top-0 -translate-x-1/2 w-10 h-3 rounded-b-lg bg-slate-700/70'; stage.appendChild(tube);
      const seq = g.kind === 'digits' ? row.nums.map(String) : row.nums.map(pad);
      const myNums = my ? (g.kind === 'digits' ? my.digits : my.nums) : null; let hits = 0;
      const size = g.kind === 'digits' ? 46 : seq.length > 5 ? 36 : 40;
      for (let i = 0; i < seq.length; i++) {
        if (token !== animToken) return;
        let hit = false;
        if (!isPick && myNums) hit = g.kind === 'digits' ? myNums[i] === row.nums[i] : myNums.includes(row.nums[i]);
        if (hit) hits++;
        tray.appendChild(ballEl(seq[i], isPick ? 'dg-ball-pick' : hit ? 'dg-ball-hit' : 'dg-ball-main', size));
        mini.textContent = `Ball ${i + 1} of ${seq.length + (row.bonus != null && g.bonus ? 1 : 0)}${myNums && !isPick ? ` · ${hits} match${hits === 1 ? '' : 'es'}` : ''}`;
        await sleep(wait);
      }
      if (row.bonus != null && g.bonus) {
        if (token !== animToken) return; await sleep(reduced() ? 0 : 500);
        const lab = document.createElement('div'); lab.className = 'w-full text-center text-[9px] text-red-300 font-bold'; lab.textContent = isPick ? g.bonus.name : `${g.bonus.name}${g.bonus.picked ? '' : ' (drawn from the rest)'}`;
        const bHit = !isPick && my && (g.bonus.picked ? my.bonus === row.bonus : (my.nums || []).includes(row.bonus));
        tray.appendChild(ballEl(pad(row.bonus), bHit ? 'dg-ball-hit dg-ball-bonusring' : 'dg-ball-bonus', size)); tray.appendChild(lab);
        mini.textContent = `All ${seq.length + 1} balls${myNums && !isPick ? ` · ${hits} match${hits === 1 ? '' : 'es'}${bHit ? ' + ' + g.bonus.name : ''}` : ''}`;
      }
    }
    if (token !== animToken) return;
    if (isPick) { res.textContent = `That's your pick. ${DISCLAIMER}`; return; }
    if (my) { const t = g.kind === 'digits' ? { playType: my.playType || S().playType, digits: my.digits, wager: my.wager || S().wager } : { nums: my.nums, bonus: my.bonus, opts: my.opts || {} }; const gr = E.grade(g, t, row); res.innerHTML = `<b>${esc(my.name || 'Your ticket')}</b> vs this result: ${esc(gr ? gr.text : '')}. <span class="text-slate-400">Prize tiers from the official chart; each draw is independent.</span> <span class="text-amber-200 font-bold">${esc(NOT_OFFICIAL)}</span>`; }
    else res.textContent = 'Official result. Make a pick to see your matches light up.';
  }
  function replayLatest() { const R = rowsForStats(); if (!R.length) { $('dg-bd-result').textContent = 'Data unavailable: no official result loaded.'; return; } animate(R[0], { kind: 'result' }); }
  function revealPick() {
    const pk = state.pick, g = G(); if (!pk) { $('dg-bd-result').textContent = 'Make a pick first (Auto Picks or My Numbers).'; return; }
    const row = g.kind === 'digits' ? { nums: pk.digits, date: null, session: 'main' } : { nums: pk.nums.slice(), bonus: g.bonus && g.bonus.picked ? pk.bonus : null, date: null, session: 'main' };
    animate(row, { kind: 'pick', label: pk.name });
  }

  // ---------- game switching ----------
  function active() { return !!state.game && typeof activeGameKey !== 'undefined' && activeGameKey === state.game; }
  const QD_HIDE = ['qd-generator-card', 'quickdraw-venue-section', 'heatmap-panel'];
  function styleButtons(key) {
    document.querySelectorAll('#game-picker [id^="game-btn-"]').forEach(btn => {
      const on = btn.id === 'game-btn-' + key;
      btn.className = (on ? 'bg-cyan-600 text-white font-black shadow' : 'bg-[#111c38] text-slate-300 hover:text-white border border-slate-800 font-bold') + ' py-1.5 px-2.5 rounded-lg text-xs transition text-center whitespace-nowrap shrink-0';
    });
  }
  async function select(key) {
    try { localStorage.setItem(LS_GAME, key); } catch (e) {}
    const panel = $('dg-panel');
    if (key === 'quickdraw') {
      state.game = null; animToken++;
      if (panel) panel.hidden = true;
      QD_HIDE.forEach(id => { const el = $(id); if (el && el.dataset.dgHidden) { el.style.display = el.dataset.dgPrev || ''; delete el.dataset.dgHidden; } });
      await switchGameProfile('quickdraw'); styleButtons('quickdraw'); return;
    }
    const g = E.GAMES[key]; if (!g) return;
    // Keep the legacy page quiet: it only acts on Quick Draw, and needs a config entry for the active key.
    if (typeof GAME_CONFIGS !== 'undefined' && !GAME_CONFIGS[key]) GAME_CONFIGS[key] = { name: g.name, totalNumbers: g.max || 10, tableName: g.table, defaultSpots: [g.pick || g.digits], maxSpot: g.pick || g.digits, hasBonus: !!g.bonus, wagerOptions: [g.price], defaultWager: g.price, timerLabel: 'Next Draw', defaultTime: 86400, optimalLookback: '100' };
    activeGameKey = key; state.game = key; state.pick = null; state.lookback = 'auto'; animToken++;
    { const fpp = $('four-picks-panel'); if (fpp) fpp.hidden = true; const xw = $('extra-wheel-panel'); if (xw) xw.hidden = true; try { previewVenueDrawer(false); } catch (e) {} }
    QD_HIDE.forEach(id => { const el = $(id); if (el && !el.dataset.dgHidden) { el.dataset.dgPrev = el.style.display || ''; el.dataset.dgHidden = '1'; el.style.display = 'none'; } });
    { const vs = $('venue-search-box'); if (vs) vs.style.display = 'none'; }
    const eng = $('header-engine-mode'); if (eng) eng.innerText = g.name;
    styleButtons(key);
    if (!panel) return; panel.hidden = false; if (!panel.dataset.built) { shell(); panel.dataset.built = '1'; }
    renderHead(); renderSettings(); renderAuto(); $('dg-ticket').hidden = true; $('dg-bd-stage').innerHTML = ''; $('dg-bd-result').textContent = ''; $('dg-bd-mini').textContent = ''; $('dg-inspect').hidden = true; $('dg-notice').hidden = true;
    $('dg-auto-status').textContent = 'Tap a button: it fills the settings and numbers below from the game\'s real history.';
    renderLog(); tick();
    const sync = $('sync-status'); if (sync) sync.innerText = 'Loading';
    const rows = await load(key);
    if (state.game !== key) return;
    if (sync) sync.innerText = rows ? 'Synced' : 'No data';
    renderHead(); renderStats(); renderHistory(); markSame(); gradeAll(key); renderLog();
    if (rows && rows.length) replayLatest();
  }

  // Styles for the result replay balls (reuses Quick Draw's bdLand keyframes).
  const css = document.createElement('style');
  css.textContent = `.dg-ball{border-radius:9999px;display:flex;align-items:center;justify-content:center;font-weight:900;color:#0b132b;border:1px solid #93c5fd;background:radial-gradient(circle at 35% 30%,#e0f2fe,#60a5fa 60%,#1e3a8a);animation:dgFall .6s cubic-bezier(.3,1.35,.5,1) both;box-shadow:0 3px 6px rgba(0,0,0,.45)}
  .dg-ball-hit{background:radial-gradient(circle at 35% 30%,#fef9c3,#facc15 55%,#a16207);border-color:#fde047;color:#111827;box-shadow:0 0 12px rgba(250,204,21,.85)}
  .dg-ball-pick{background:radial-gradient(circle at 35% 30%,#fef9c3,#facc15 55%,#a16207);border-color:#fde047;color:#111827}
  .dg-ball-bonus{background:radial-gradient(circle at 35% 30%,#fecaca,#ef4444 60%,#7f1d1d);color:#fff;border-color:#fca5a5}
  .dg-ball-bonusring{outline:3px solid #ef4444;outline-offset:1px}
  .bd-cell.dg-mine{border:1.5px dashed #22d3ee;color:#a5f3fc}
  #game-picker .dg-scroll{scrollbar-width:none}#game-picker .dg-scroll::-webkit-scrollbar{display:none}
  @keyframes dgFall{0%{opacity:0;transform:translateY(-70px) scale(.7)}65%{opacity:1;transform:translateY(4px) scale(1.06)}82%{transform:translateY(-3px)}100%{opacity:1;transform:none}}
  @media (prefers-reduced-motion: reduce){.dg-ball{animation:none}}`;
  document.head.appendChild(css);

  window.DGUI = { select, active, secondsToNext, flags: FLAGS, _state: state, _animate: animate, _runMode: runMode };
  setInterval(tick, 1000);
  setInterval(() => { checkNotices(true); }, 5 * 60 * 1000);
  setTimeout(() => { checkNotices(false); }, 4000);
})();
