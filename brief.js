// Offer brief: context for the copy (what the buyer gets, time, money, risk). Lives in drafts and in the
// exported .md; never in the built site. Fields follow offers/_templates/offer-brief.md and PLAYBOOK §1.
import { toText } from "./rules.js?v=127df33a";

export const ARCHETYPES = {
  currency: ["Currency", "Главные оси — Time (минуты до рук) и Risk (сделка выглядит обычной). Outcome — через то, что купят на эту валюту."],
  item: ["Item", "Главные оси — Outcome (что предмет делает в билде) и Risk (именно тот предмет, именно те роллы)."],
  service: ["Progress service", "Главные оси — Time (часы) и Outcome (что открыто после). Risk — лут остаётся, способ, кто заходит."],
  build: ["Build", "Главные оси — Outcome цифрой (какой контент закрывает) и Risk (как доказываем, что сработало)."],
  bundle: ["Bundle", "Главная ось — Outcome (готовое состояние) + ценовой якорь. У бонуса называем стоимость."],
};
export const SEGMENTS = ["League-start speedrunner", "Short on play time", "Stuck — the build can't push", "Wants one chase item (Mageblood, Headhunter…)", "Trader and crafter", "Completionist: challenges, cosmetics"];
// Earlier labels, so drafts made before the rename keep their segment.
export const SEGMENT_RENAMES = { "Гонщик старта лиги": SEGMENTS[0], "Взрослый без времени": SEGMENTS[1], "Застрявший в мидгейме": SEGMENTS[2], "Охотник за чейзом": SEGMENTS[3], "Торговец / крафтер": SEGMENTS[4], "Коллекционер / комплитист": SEGMENTS[5],
  "Спидранер старта лиги": SEGMENTS[0], "Мало времени на игру": SEGMENTS[1], "Застрял — билд не тянет": SEGMENTS[2], "Хочет конкретный редкий предмет (Mageblood, Headhunter…)": SEGMENTS[3], "Торгует и крафтит": SEGMENTS[4], "Собирает всё: челленджи, косметику": SEGMENTS[5] };

// Search phrases by archetype, most searched first. {s}/{f} = short/full game name (GAMES), {p} = product name.
export const KEYWORD_TEMPLATES = {
  service: ["Buy {s} {p} boost", "{s} {p} boost", "{s} {p} carry", "{s} {p} boost service", "{s} {p} carry service", "{s} {p} boosting", "{s} {p} boosting service",
    "{f} {p} boost", "{f} {p} carry", "{f} {p} boost service", "{f} {p} carry service", "{f} {p} boosting", "{f} {p} boosting service"],
  trade: ["Buy {s} {p}", "{s} {p} for sale", "cheap {s} {p} for sale", "buy cheap {s} {p}", "Buy {f} {p}", "{f} {p} for sale", "cheap {f} {p} for sale", "buy cheap {f} {p}",
    "Purchase {s} {p}", "Purchase {f} {p}"],
};
const TEMPLATE_OF = { service: "service", build: "service", bundle: "service", currency: "trade", item: "trade" };
export function suggestKeywords(archetype, product, [short, full] = []) {
  const list = KEYWORD_TEMPLATES[TEMPLATE_OF[archetype]] || [];
  const out = list.map((t) => t.replace("{s}", short || "").replace("{f}", full || "").replace("{p}", (product || "").trim()).replace(/\s+/g, " ").trim());
  return [...new Set(out)];
}
export const keywordList = (b) => [...new Set([b.keyword, ...String(b.keywords || "").split("\n")].map((s) => (s || "").trim()).filter(Boolean))];

// [key, label, kind, placeholder]  kind: text | area | keywords | select:<list> | money
export const BRIEF_FIELDS = [
  ["Basics", [
    ["archetype", "Archetype", "select:archetype", ""],
    ["keyword", "Main keyword", "text", "PoE 2 Ascension Trials Boost"],
    ["product", "Product name (as in search)", "text", "Ascension Trials"],
    ["keywords", "Search phrases — most searched first", "keywords", "PoE 2 Ascension Trials boost"],
    ["segment", "Main segment", "select:segment", ""],
    ["league", "League / patch", "text", "Forbidden Rites, 0.5.5"],
  ]],
  ["Outcome", [
    ["outcome", "What the buyer gets", "area", "8 очков асценданси на своём персонаже, все 4 ступени"],
  ]],
  ["Time & money", [
    ["time", "Completion time (median)", "text", "15 min"],
    ["start", "Start time", "text", "15 min"],
    ["solo", "Time to do it solo", "text", "3–5 h"],
    ["price", "Price from, $", "money", "10"],
    ["bonus", "Bonus", "text", "FREE Rakiata's Flow"],
    ["bonusValue", "Bonus value, $", "money", "5"],
  ]],
  ["Risk & edge", [
    ["fear", "Main fear and what removes it", "area", "боится отдать аккаунт → есть self-play"],
    ["edge", "Edge over competitors", "area", "клиент сам выбирает асценданси у алтаря"],
  ]],
  ["Requirements", [
    ["requirements", "Buyer requirements — context, any wording", "area", "Trial of Sekhemas открыт, уровень от 22"],
  ]],
  ["FAQ", [
    ["faqSupport", "Questions from support — one per line", "area", "Can I do it on Hardcore?"],
  ]],
];

// "15 min", "5 hours", "12h" → minutes
const DUR = /(\d+(?:[.,]\d+)?)\s*[-–]?\s*(?:(\d+(?:[.,]\d+)?)\s*)?(min(?:ute)?s?|мин\p{L}*|h(?:ours?|rs?)?|час\p{L}*|ч(?![\p{L}]))(?![\p{L}])/giu;
function durations(s) {
  const out = [];
  for (const m of (s || "").matchAll(DUR)) {
    const unit = /^(min|мин)/i.test(m[3]) ? 1 : 60;
    out.push(Math.round(parseFloat(m[1].replace(",", ".")) * unit));
    if (m[2]) out.push(Math.round(parseFloat(m[2].replace(",", ".")) * unit));
  }
  return out;
}
const fmt = (min) => (min >= 60 && min % 60 === 0 ? `${min / 60} h` : `${min} min`);

// Logic checks between the brief and the copy. Returns {box: {index: [warn]}, notes: {index: [note]}, page: [msg]}.
export function briefChecks(offer) {
  const b = offer.brief || {}, box = {}, notes = {}, page = [];
  const add = (map, i, msg) => (map[i] ||= []).push(msg);
  const kw = (b.keyword || "").trim().toLowerCase();
  const known = new Set([...durations(b.time), ...durations(b.start), ...durations(b.solo)]);
  const prices = new Set([b.price, b.bonusValue].filter(Boolean).map((p) => String(p).replace(/[^\d.]/g, "")));
  offer.boxes.forEach((x, i) => {
    const t = toText(x.kind, x.lines, offer.method);
    if (!t.trim()) return;
    if (kw && ["h1", "hero"].includes(x.kind) && !t.toLowerCase().startsWith(kw))
      add(box, i, `начинается не с главного ключа «${b.keyword}»`);
    // meta title is "Buy {phrase}, {phrase} | Overgear": the main keyword sits inside, after "Buy"
    if (kw && x.kind === "page-title" && !t.toLowerCase().includes(kw))
      add(box, i, `нет главного ключа «${b.keyword}» — title собирается из поисковых фраз`);
    if (known.size && !["seo-footer", "requirements"].includes(x.kind))
      for (const d of durations(t)) if (!known.has(d)) add(notes, i, `срок ${fmt(d)} не совпадает с брифом (${[...known].map(fmt).join(", ")}) — проверьте`);
    if (prices.size) for (const m of t.matchAll(/\$\s?(\d+(?:\.\d+)?)/g)) if (!prices.has(m[1])) add(notes, i, `цена $${m[1]} не совпадает с брифом`);
    if (b.bonusValue && /\bFREE\b/.test(t) && !t.includes("$" + b.bonusValue) && ["card-preview", "usp-title", "usp-tooltips", "description"].includes(x.kind))
      add(notes, i, `FREE без стоимости — в брифе бонус стоит $${b.bonusValue}`);
  });
  keywordRule(offer, keywordList(b), (i, msg) => add(box, i, msg));
  if (Object.values(b).some((v) => v && String(v).trim()) && !kw) page.push("В брифе не указан главный ключ — без него не проверить H1, hero и meta title");
  return { box, notes, page };
}

// Keyword rule: every search phrase appears at most once across hero, description, SEO footer and FAQ,
// and two sentences with a phrase always have a sentence without one between them.
// A longer phrase wins over a phrase it contains ("Buy PoE 2 X boost" is not also "PoE 2 X boost").
const RULE_KINDS = ["hero", "description", "seo-footer", "faq"];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function keywordHits(text, phrases) {
  const sorted = [...phrases].sort((a, b) => b.length - a.length), taken = [], hits = [];
  for (const p of sorted) {
    const re = new RegExp(`(?<![\\p{L}\\d])${esc(p).replace(/\s+/g, "\\s+")}(?![\\p{L}\\d])`, "giu");
    for (const m of text.matchAll(re)) {
      const a = m.index, z = a + m[0].length;
      if (taken.some(([x, y]) => a < y && z > x)) continue;
      taken.push([a, z]); hits.push({ phrase: p, at: a });
    }
  }
  return hits.sort((x, y) => x.at - y.at);
}
function keywordRule(offer, phrases, warn) {
  if (!phrases.length) return;
  const seen = new Map();
  // Hero is the first paragraph of Description on the page, so with a Description it is not counted twice.
  const hasDescription = offer.boxes.some((x) => x.kind === "description" && x.lines.some((l) => l.trim()));
  offer.boxes.forEach((x, i) => {
    if (!RULE_KINDS.includes(x.kind) || (x.kind === "hero" && hasDescription)) return;
    const sentences = toText(x.kind, x.lines, offer.method).split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim());
    let prev = false;
    sentences.forEach((s) => {
      const hits = keywordHits(s, phrases);
      for (const { phrase } of hits) {
        const k = phrase.toLowerCase();
        if (seen.has(k)) warn(i, `ключ «${phrase}» уже есть в «${seen.get(k)}» — в оффере одно упоминание`);
        else seen.set(k, x.label || x.kind);
      }
      if (hits.length > 1) warn(i, `в одном предложении два ключа: «${hits.map((h) => h.phrase).join("», «")}»`);
      if (hits.length && prev) warn(i, `подряд два предложения с ключом — нужно предложение без ключа между ними: «${s.trim().slice(0, 60)}…»`);
      prev = hits.length > 0;
    });
  });
}

export function briefMd(offer) {
  const b = offer.brief || {};
  const rows = BRIEF_FIELDS.flatMap(([, fs]) => fs).filter(([k]) => b[k]).map(([k, label]) => {
    let v = String(b[k]).replace(/\n/g, " ");
    if (k === "archetype") v = (ARCHETYPES[v] || [v])[0];
    if (k === "keywords") v = String(b[k]).split("\n").map((s) => s.trim()).filter(Boolean).map((s, n) => `${n + 1}. ${s}`).join("; ");
    return `| ${label} | ${v.replace(/\|/g, "/")} |`;
  });
  return rows.length ? ["## Бриф (из content-helper)", "", "| Поле | Значение |", "|---|---|", ...rows, ""].join("\n") : "";
}
