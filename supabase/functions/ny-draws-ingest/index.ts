// ny-draws-ingest: fetch-only ingest of official NY Lottery results from data.ny.gov
// into the Draw Buddy tables. It never generates, interpolates, or edits numbers:
// rows that fail validation are skipped and counted, never "fixed".
//
// Sources (Socrata / SODA):
//   Quick Draw    https://data.ny.gov/resource/7sqk-ycpk.json
//   Powerball     https://data.ny.gov/resource/d6yy-54nr.json
//   Mega Millions https://data.ny.gov/resource/5xaw-6ayf.json
//
// Auth: verify_jwt is off; callers must send x-ingest-token equal to the Vault
// secret 'ny_draws_ingest_token' (pg_cron reads it from Vault at call time).
// DB access uses the built-in SUPABASE_DB_URL; no API keys are used or stored.
//
// Body: { games?: ("quickdraw"|"powerball"|"megamillions")[], trigger?: string,
//         qd_after?: number,  // Quick Draw: only fetch draw_number > qd_after (backfill)
//         qd_cap?: number,    // max Quick Draw rows per call (default 4000, max 8000)
//         full?: boolean,     // PB/MM: fetch full history instead of recent window
//         dry_run?: boolean }
//
// Quick Draw also stores the official draw time (convention approved by legal, v4):
//   draw_date        = data.ny.gov draw_date exactly as published (the draw day)
//   draw_time_source = data.ny.gov draw_time string exactly as published (may exceed 24:00, e.g. '27:24')
//   draw_time        = real ET wall-clock time (e.g. 03:24)
//   draw_at          = real instant (timestamptz), DST-correct
// Powerball/Mega Millions datasets carry no draw time.

import postgres from "npm:postgres@3.4.5";

const SODA = "https://data.ny.gov/resource";
const DS = { quickdraw: "7sqk-ycpk", powerball: "d6yy-54nr", megamillions: "5xaw-6ayf" } as const;
type Game = keyof typeof DS;

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, idle_timeout: 20 });

function ints(s: unknown): number[] | null {
  if (typeof s !== "string") return null;
  const parts = s.trim().split(/\s+/);
  const out = parts.map((p) => (/^\d+$/.test(p) ? parseInt(p, 10) : NaN));
  return out.some((n) => !Number.isInteger(n)) ? null : out;
}
function optInt(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).trim();
  return /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
}
function distinctInRange(a: number[], lo: number, hi: number) {
  return new Set(a).size === a.length && a.every((n) => n >= lo && n <= hi);
}
function dateKey(d: unknown): { key: number; date: string } | null {
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(d)) return null;
  const date = d.slice(0, 10);
  return { key: parseInt(date.replaceAll("-", ""), 10), date };
}

// ---- Official ET wall-clock -> instant (DST-correct, no external libs) ----
// data.ny.gov Quick Draw draw_time can exceed 24:00 (the draw day runs ~4:00 AM to ~3:24 AM next day),
// e.g. draw_date 2026-11-13 + "27:24" = 2026-11-14 03:24 ET. We normalize to the real calendar date/time.
const ET_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});
function etWallMs(instantMs: number): number {
  const p: Record<string, number> = {};
  for (const x of ET_FMT.formatToParts(new Date(instantMs))) if (x.type !== "literal") p[x.type] = parseInt(x.value, 10);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
}
// Returns normalized wall date/time and all valid instants (0 = DST gap, 2 = DST repeated hour).
function etCandidates(drawDate: unknown, drawTime: unknown) {
  if (typeof drawDate !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(drawDate)) return null;
  if (typeof drawTime !== "string" || !/^\d{1,2}:\d{2}$/.test(drawTime.trim())) return null;
  const [y, m, d] = drawDate.slice(0, 10).split("-").map(Number);
  const [hh, mm] = drawTime.trim().split(":").map(Number);
  if (mm > 59 || hh > 47) return null;
  const wall = Date.UTC(y, m - 1, d) + hh * 3600e3 + mm * 60e3;
  const w = new Date(wall).toISOString();
  const instants = [4, 5].map((off) => wall + off * 3600e3).filter((t) => etWallMs(t) === wall).sort((a, b) => a - b);
  return { date: w.slice(0, 10), time: w.slice(11, 19), instants };
}

async function soda(ds: string, params: Record<string, string>) {
  const u = new URL(`${SODA}/${ds}.json`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`data.ny.gov ${ds} HTTP ${r.status}`);
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error(`data.ny.gov ${ds} returned non-array`);
  return { url: u.toString(), rows: j as Record<string, unknown>[] };
}

async function runQuickDraw(body: any, trigger: string) {
  const cap = Math.min(Math.max(parseInt(body.qd_cap ?? 4000, 10) || 4000, 1), 8000);
  let after: number | null = body.qd_after != null ? Number(body.qd_after) : null;
  if (after == null) {
    const [{ m }] = await sql`select max(draw_number)::bigint as m from public.quickdraw_history`;
    after = m == null ? null : Number(m);
  }
  const params: Record<string, string> = { $order: "draw_number ASC", $limit: String(cap) };
  if (after != null) params.$where = `draw_number > ${Math.trunc(after)}`;
  else {
    const since = new Date(Date.now() - 31 * 86400e3).toISOString().slice(0, 10);
    params.$where = `draw_date >= '${since}T00:00:00'`;
  }
  const { url, rows } = await soda(DS.quickdraw, params);
  type QD = { draw_number: number; winning_numbers: number[]; extra_multiplier: number | null;
    draw_date: string | null; draw_time: string | null; draw_at: string | null; draw_time_source: string | null };
  const good: QD[] = [];
  let bad = 0, timeUnresolved = 0;
  // Previous stored instant, to place draws in the repeated DST hour (instants must increase with draw_number).
  let prevAt: number | null = null;
  const firstDn = rows.length ? optInt(rows[0].draw_number) : null;
  if (firstDn && !Number.isNaN(firstDn)) {
    const p = await sql`select draw_at from public.quickdraw_history where draw_number < ${firstDn} and draw_at is not null order by draw_number desc limit 1`;
    if (p.length) prevAt = new Date(p[0].draw_at).getTime();
  }
  for (const r of rows) {
    const dn = optInt(r.draw_number);
    const wn = ints(r.winning_numbers);
    const ex = optInt(r.extra_multiplier);
    if (!dn || Number.isNaN(dn) || !wn || wn.length !== 20 || !distinctInRange(wn, 1, 80) || Number.isNaN(ex as number)) { bad++; continue; }
    const c = etCandidates(r.draw_date, r.draw_time);
    const srcDate = typeof r.draw_date === "string" && /^\d{4}-\d{2}-\d{2}/.test(r.draw_date) ? r.draw_date.slice(0, 10) : null;
    const srcTime = typeof r.draw_time === "string" && r.draw_time.trim() !== "" ? r.draw_time.trim() : null;
    let at: number | null = null;
    if (c && c.instants.length === 1) at = c.instants[0];
    else if (c && c.instants.length === 2) at = c.instants.find((t) => prevAt == null || t > prevAt) ?? null;
    if (at == null) { timeUnresolved++; good.push({ draw_number: dn, winning_numbers: wn, extra_multiplier: ex, draw_date: srcDate, draw_time: null, draw_at: null, draw_time_source: srcTime }); continue; }
    prevAt = at;
    good.push({ draw_number: dn, winning_numbers: wn, extra_multiplier: ex, draw_date: srcDate, draw_time: c!.time, draw_at: new Date(at).toISOString(), draw_time_source: srcTime });
  }
  return { url, fetched: rows.length, bad, good, timeUnresolved };
}

async function runBig(game: "powerball" | "megamillions", body: any) {
  const params: Record<string, string> = { $order: "draw_date ASC", $limit: "50000" };
  if (!body.full) {
    const tbl = game === "powerball" ? sql`public.powerball_history` : sql`public.megamillions_history`;
    const [{ d }] = await sql`select max(draw_date)::text as d from ${tbl}`;
    if (d) {
      const since = new Date(Date.parse(d) - 21 * 86400e3).toISOString().slice(0, 10);
      params.$where = `draw_date >= '${since}T00:00:00'`;
    }
  }
  const { url, rows } = await soda(DS[game], params);
  const good: { draw_number: number; draw_date: string; winning_numbers: number[]; bonus_number: number; extra_multiplier: number | null }[] = [];
  let bad = 0;
  for (const r of rows) {
    const dk = dateKey(r.draw_date);
    const wn = ints(r.winning_numbers);
    const mult = optInt(r.multiplier);
    if (!dk || !wn || Number.isNaN(mult as number)) { bad++; continue; }
    let whites: number[]; let bonus: number | null;
    if (game === "powerball") {
      if (wn.length !== 6) { bad++; continue; }
      whites = wn.slice(0, 5); bonus = wn[5];
    } else {
      if (wn.length !== 5) { bad++; continue; }
      whites = wn; bonus = optInt(r.mega_ball);
    }
    if (!distinctInRange(whites, 1, 80) || !bonus || Number.isNaN(bonus) || bonus < 1 || bonus > 52) { bad++; continue; }
    good.push({ draw_number: dk.key, draw_date: dk.date, winning_numbers: whites, bonus_number: bonus, extra_multiplier: mult });
  }
  return { url, fetched: rows.length, bad, good };
}

async function upsert(game: Game, good: any[]) {
  if (good.length === 0) return { inserted: 0, updated: 0 };
  const payload = JSON.stringify(good);
  let res;
  if (game === "quickdraw") {
    res = await sql`
      insert into public.quickdraw_history as t (draw_number, winning_numbers, extra_multiplier, draw_date, draw_time, draw_at, draw_time_source)
      select r.draw_number, r.winning_numbers, r.extra_multiplier, r.draw_date, r.draw_time, r.draw_at, r.draw_time_source
      from jsonb_to_recordset((${payload}::text)::jsonb) as r(draw_number bigint, winning_numbers int[], extra_multiplier int, draw_date date, draw_time time, draw_at timestamptz, draw_time_source text)
      on conflict (draw_number) do update
        set winning_numbers = excluded.winning_numbers, extra_multiplier = excluded.extra_multiplier,
            draw_date = coalesce(excluded.draw_date, t.draw_date), draw_time = coalesce(excluded.draw_time, t.draw_time),
            draw_at = coalesce(excluded.draw_at, t.draw_at), draw_time_source = coalesce(excluded.draw_time_source, t.draw_time_source)
        where (t.winning_numbers, t.extra_multiplier) is distinct from (excluded.winning_numbers, excluded.extra_multiplier)
           or (t.draw_date, t.draw_time, t.draw_at, t.draw_time_source) is distinct from
              (coalesce(excluded.draw_date, t.draw_date), coalesce(excluded.draw_time, t.draw_time),
               coalesce(excluded.draw_at, t.draw_at), coalesce(excluded.draw_time_source, t.draw_time_source))
      returning (xmax = 0) as ins`;
  } else {
    const tbl = game === "powerball" ? sql`public.powerball_history` : sql`public.megamillions_history`;
    res = await sql`
      insert into ${tbl} as t (draw_number, draw_date, winning_numbers, bonus_number, extra_multiplier)
      select r.draw_number, r.draw_date, r.winning_numbers, r.bonus_number, r.extra_multiplier
      from jsonb_to_recordset((${payload}::text)::jsonb) as r(draw_number bigint, draw_date date, winning_numbers int[], bonus_number int, extra_multiplier int)
      on conflict (draw_number) do update
        set draw_date = excluded.draw_date, winning_numbers = excluded.winning_numbers,
            bonus_number = excluded.bonus_number, extra_multiplier = excluded.extra_multiplier
        where (t.draw_date, t.winning_numbers, t.bonus_number, t.extra_multiplier)
          is distinct from (excluded.draw_date, excluded.winning_numbers, excluded.bonus_number, excluded.extra_multiplier)
      returning (xmax = 0) as ins`;
  }
  const inserted = res.filter((x: any) => x.ins).length;
  return { inserted, updated: res.length - inserted };
}

function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const token = req.headers.get("x-ingest-token") ?? "";
  const [row] = await sql`select decrypted_secret as s from vault.decrypted_secrets where name = 'ny_draws_ingest_token'`;
  if (!row?.s || !token || !safeEq(token, row.s)) return new Response("unauthorized", { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const games: Game[] = (Array.isArray(body.games) ? body.games : ["quickdraw", "powerball", "megamillions"])
    .filter((g: string) => g in DS);
  const trigger = String(body.trigger ?? "manual").slice(0, 60);
  const results: Record<string, unknown> = {};

  for (const game of games) {
    const [{ id }] = await sql`insert into ingest.runs (game, trigger) values (${game}, ${trigger}) returning id`;
    try {
      const r = game === "quickdraw" ? await runQuickDraw(body, trigger) : await runBig(game, body);
      const w = body.dry_run ? { inserted: 0, updated: 0 } : await upsert(game, r.good);
      const maxKey = r.good.length ? Math.max(...r.good.map((g: any) => g.draw_number)) : null;
      await sql`update ingest.runs set finished_at = now(), source_url = ${r.url}, fetched = ${r.fetched},
        inserted = ${w.inserted}, updated = ${w.updated}, skipped_invalid = ${r.bad}, max_key = ${maxKey},
        status = ${body.dry_run ? "dry_run" : "ok"} where id = ${id}`;
      const tu = (r as any).timeUnresolved ?? 0;
      if (tu > 0) await sql`update ingest.runs set error = ${`draw time unresolved for ${tu} row(s); stored without time`} where id = ${id}`;
      results[game] = { fetched: r.fetched, valid: r.good.length, skipped_invalid: r.bad, ...w, max_key: maxKey, ...(game === "quickdraw" ? { time_unresolved: tu } : {}) };
    } catch (e) {
      const msg = String((e as Error)?.message ?? e).slice(0, 500);
      await sql`update ingest.runs set finished_at = now(), status = 'error', error = ${msg} where id = ${id}`;
      results[game] = { error: msg };
    }
  }
  return new Response(JSON.stringify(results), { headers: { "content-type": "application/json" } });
});
