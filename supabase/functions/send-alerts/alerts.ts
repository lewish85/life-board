// Pure logic: which alerts are due right now? (no network, easy to test)
export type Doc = { coll: string; id: string; data: Record<string, any> };
export type Alert = { key: string; title: string; body: string; tag: string; url: string };

const AREA: Record<string, { name: string; dot: string }> = {
  uni: { name: "Uni", dot: "🔵" }, work: { name: "Work", dot: "🩵" }, personal: { name: "Personal", dot: "🟣" },
  health: { name: "Health", dot: "🟢" }, errands: { name: "Errands", dot: "🟠" },
};
export const DEFAULT_ALERT = 5; // minutes before start
const CATCH_UP = 10;            // still send if the scheduler ran a few minutes late

const pad = (n: number) => String(n).padStart(2, "0");
const toUTC = (k: string) => { const [y, m, d] = k.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const isoUTC = (t: number) => { const d = new Date(t); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
export const addDays = (k: string, n: number) => isoUTC(toUTC(k) + n * 864e5);
const dayDiff = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / 864e5);
const dow = (k: string) => (new Date(toUTC(k)).getUTCDay() + 6) % 7; // Mon=0
const weekStart = (k: string) => addDays(k, -dow(k));

export function localNow(tz: string, at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, min: +g("hour") * 60 + +g("minute") };
}

function rule(r: any) {
  const days = Array.isArray(r.days) && r.days.length ? r.days : [dow(r.from)];
  if (r.freq === "weekdays") return { freq: "weekly", interval: 1, days: [0, 1, 2, 3, 4] };
  if (r.freq === "fortnightly") return { freq: "weekly", interval: 2, days };
  return { freq: r.freq || "daily", interval: Math.max(1, r.interval || 1), days };
}
export function occurs(r: any, k: string) {
  if (!r.from || k < r.from) return false;
  if (r.until && k > r.until) return false;
  const R = rule(r);
  if (R.freq === "daily") return dayDiff(r.from, k) % R.interval === 0;
  if (R.freq === "weekly") {
    if (!R.days.includes(dow(k))) return false;
    return (dayDiff(weekStart(r.from), weekStart(k)) / 7) % R.interval === 0;
  }
  if (R.freq === "monthly") {
    const [fy, fm, fd] = r.from.split("-").map(Number), [y, m, d] = k.split("-").map(Number);
    const months = (y - fy) * 12 + (m - fm);
    if (months % R.interval) return false;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return d === Math.min(fd, last);
  }
  return false;
}

const fmtTime = (m: number) => { m = ((m % 1440) + 1440) % 1440; const h = Math.floor(m / 60); return `${h % 12 || 12}:${pad(m % 60)} ${h < 12 ? "am" : "pm"}`; };
const lead = (a: number) => (a === 0 ? "starting now" : a < 60 ? `in ${a} min` : a % 60 ? `in ${Math.floor(a / 60)}h ${a % 60}m` : `in ${a / 60} hour${a > 60 ? "s" : ""}`);
const ICON_FALLBACK: Record<string, string> = { uni: "🎓", work: "💼", personal: "✨", health: "💪", errands: "🧾" };
// same smart-icon rules as the app (app.js), for older entries saved without an icon
const ICON_RULES: [RegExp,string][]=[
  [/\b(gym|workout|weights|lift|training)\b/,"🏋️"],[/\b(run|jog|5k|10k)\b/,"🏃"],[/\b(walk|hike)\b/,"🚶"],[/\b(yoga|meditat|breath|stretch|movement|mobility)\w*/,"🧘"],
  [/\b(swim|pool)\b/,"🏊"],[/\b(bike|cycle|cycling)\b/,"🚴"],[/\b(read|book|chapter)\w*/,"📖"],[/\b(e-?mail|inbox|reply)\w*/,"✉️"],[/\b(call|phone|ring)\b/,"📞"],
  [/\b(meet|meeting|standup|sync|catch ?up)\w*/,"👥"],[/\b(lecture|class|tutorial|tute|uni|seminar|lab)\b/,"🎓"],[/\b(study|revise|revision|assignment|essay|exam|quiz|homework|capstone|report)\w*/,"📚"],
  [/\b(code|coding|dev|build|deploy|website|app)\b/,"💻"],[/\b(design|figma|sketch|draw|illustrat)\w*/,"🎨"],[/\b(edit|video|film|animation|animate)\w*/,"🎬"],[/\b(photo|shoot|camera)\w*/,"📷"],
  [/\b(shop|shopping|groceries|grocery|supermarket)\b/,"🛒"],[/\b(cook|bake|meal prep)\w*/,"🍳"],[/\b(breakfast|lunch|dinner|eat|brunch)\b/,"🍽️"],[/\b(coffee|cafe|café)\b/,"☕"],
  [/\b(sleep|bed|wind down|nap)\b/,"🌙"],[/\b(wake|rise|morning)\b/,"☀️"],[/\b(clean|tidy|vacuum|dishes)\b/,"🧽"],[/\b(laundry|washing|clothes)\b/,"🧺"],
  [/\b(car|wash car|petrol|fuel|drive)\b/,"🚗"],[/\b(train|bus|commute|tram|ferry)\b/,"🚆"],[/\b(flight|fly|airport|travel|trip)\b/,"✈️"],
  [/\b(doctor|dentist|gp|physio|appointment)\b/,"🩺"],[/\b(shower|bath)\b/,"🚿"],[/\b(guitar|piano|music|practice|band)\b/,"🎸"],[/\b(movie|cinema|netflix|show)\b/,"🍿"],
  [/\b(pay|bill|bills|rent|bank|invoice|budget)\b/,"💳"],[/\b(work|shift|job)\b/,"💼"],[/\b(party|birthday|celebrat|drinks)\w*/,"🎉"],[/\b(friend|mate|date|family|mum|dad)\b/,"💬"],
  [/\b(write|journal|blog|draft)\w*/,"✍️"],[/\b(plan|review|organi[sz]e)\w*/,"🗒️"],[/\b(plant|garden|water)\b/,"🪴"],[/\b(dog|cat|pet|vet)\b/,"🐾"],
  [/\b(pitch|present|presentation|slides|deck)\w*/,"📊"],[/\b(interview|apply|application|cv|resume)\b/,"🗂️"],[/\b(game|gaming)\b/,"🎮"],[/\b(haircut|barber)\b/,"💈"],[/\b(gift|present for)\b/,"🎁"]
];
const iconFor = (title: string, area: string) => { const t = (title || "").toLowerCase(); for (const [re, ic] of ICON_RULES) if (re.test(t)) return ic; return ICON_FALLBACK[area] || "🗒️"; };
const range = (s: number, d: number) => { const e = s + d, ap = (x: number) => (Math.floor((((x % 1440) + 1440) % 1440) / 60) < 12 ? "am" : "pm");
  return ap(s) === ap(e) ? `${fmtTime(s).replace(/ (am|pm)$/, "")}–${fmtTime(e)}` : `${fmtTime(s)}–${fmtTime(e)}`; };

/** Alerts whose time has arrived (within the catch-up window) for a user, given their local "now". */
export function dueAlerts(docs: Doc[], now: { date: string; min: number }): Alert[] {
  const out: Alert[] = [];
  for (let off = 0; off <= 1; off++) {           // tomorrow too, for early-morning tasks alerted before midnight
    const k = addDays(now.date, off);
    for (const d of docs) {
      const t = d.data || {};
      let start: number, dur: number;
      if (d.coll === "tasks") {
        if (t.done || t.schedDate !== k || !(t.schedDur > 0)) continue;
        start = t.schedStart || 0; dur = t.schedDur;
      } else if (d.coll === "routines") {
        if (!(typeof t.start === "number" && t.start >= 0 && t.dur > 0)) continue;
        if (!occurs(t, k) || (t.skip || {})[k] || (t.done || {})[k]) continue;
        start = t.start; dur = t.dur;
      } else continue;
      const alert = typeof t.alert === "number" ? t.alert : DEFAULT_ALERT;
      if (alert < 0) continue;                       // "None"
      const at = off * 1440 + start - alert;          // minutes from the start of today
      if (now.min < at || now.min >= at + CATCH_UP) continue;
      const area = AREA[t.area] || AREA.personal;
      const icon = t.icon || iconFor(t.title, t.area);
      out.push({
        key: `${d.coll}:${d.id}:${k}:${start}:${alert}`,
        title: `${icon} ${t.title || "Task"}`,
        body: `${area.dot} ${area.name} · ${range(start, dur)} · ${lead(alert)}`,
        tag: `${d.coll}:${d.id}:${k}`,
        url: `./?day=${k}#timeline`,
      });
    }
  }
  return out;
}
