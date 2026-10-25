// content-helper rules: the one place where Overgear offer fields are formatted and checked.
// Used by the browser app (app/app.js) and by the CLI (tools/check.mjs, tools/build.mjs).
// Field map and admin locations: references/page-elements.md.

export const GREEN = "rgb(150, 212, 115)";
export const ORANGE = "rgb(255, 149, 72)";

// Stop words; the second line comes from the SEO audit of 99 pages (seo/audit-2026-10-25.md).
const STOP = /\b(fast|quick|instant(?:ly)?|safe|secure|premium|reliable|effortless|seamless|smooth|dominate|unleash|ultimate|perfect|best|professional|expert|hassle|cheap|refund|money-back|compensat\w*|guarantee\w*|versatile|tailored|wide selection|24\/7|journey|whether you(?:'re| are)?|in no time|lowest prices?|competitive prices?|order (?:now|today)|unlock the full potential|look no further|widely considered|without breaking the bank|stress-free)\b/gi;

// kind: [name in the app, admin field, plain text only, limits]
export const TYPES = {
  "card-preview": ["UVP preview", "Description → Short description (UVP preview в каталоге)", false, { line: [12, 28], lines: 3 }],
  "usp-title": ["UVP", "USP → Title", true, { len: [12, 32] }],
  "usp-tooltips": ["Тултипы", "USP → Short description (тултипы)", false, { item: 120, total: 280, lines: 3 }],
  "hero": ["Hero-line", "Description → Description, первый абзац", false, { len: [120, 180] }],
  "description": ["Description целиком", "Description → Description (весь блок)", false, {}],
  "h1": ["H1", "SEO Texts → Meta Title (H1)", true, { len: [1, 45] }],
  "page-title": ["Meta title", "SEO Texts → Page Title (head)", true, { len: [45, 85] }],
  "meta-description": ["Meta description", "SEO Texts → Meta Description (head)", true, { len: [120, 160] }],
  "seo-footer": ["SEO-футер", "SEO Texts → Footer Description (SEO)", false, {}],
  "faq": ["FAQ", "SEO Texts → FAQ (каждая пара — своё поле: вопрос / ответ)", true, {}],
  "requirements": ["Requirements", "Description → блок контента Spoiler «Requirements» (текст)", false, {}],
  "feed-subtitle": ["itemSubtitleForFeed", "Маршрут → feedData → Item Subtitle", true, { len: [30, 60] }],
  "feed-description": ["itemDescriptionForFeed", "Маршрут → feedData → Item Description", true, { len: [90, 160] }],
};

// offers/<game>/ folder → [short name for itemSubtitleForFeed, full name for itemDescriptionForFeed, display name]
export const GAMES = {
  "poe-2": ["PoE 2", "Path of Exile 2", "Path of Exile 2"],
  "poe": ["PoE", "Path of Exile", "Path of Exile"],
  "diablo-4": ["D4", "Diablo 4", "Diablo 4"], // house titles pair both: "Buy Diablo 4 X, Cheap D4 X for Sale"
  "last-epoch": ["Last Epoch", "Last Epoch", "Last Epoch"],
  "torchlight-infinite": ["Torchlight", "Torchlight: Infinite", "Torchlight: Infinite"],
  "diablo-2-resurrected": ["D2R", "Diablo 2 Resurrected", "Diablo 2 Resurrected"],
  "diablo-3": ["Diablo 3", "Diablo 3", "Diablo 3"],
  "wow": ["WoW", "World of Warcraft", "World of Warcraft"],
  "wow-forever": ["WoW Forever", "WoW Forever", "WoW Forever"],
};

// The order and set of fields a full offer page has (template for a new offer).
export const TEMPLATE = [
  ["Карточка в каталоге", "card-preview", "", ["", "", ""]],
  ["UVP и тултипы", "usp-title", "UVP 1 · Time", [""]], ["UVP и тултипы", "usp-tooltips", "UVP 1 · Time", ["", "", ""]],
  ["UVP и тултипы", "usp-title", "UVP 2 · Outcome", [""]], ["UVP и тултипы", "usp-tooltips", "UVP 2 · Outcome", ["", "", ""]],
  ["UVP и тултипы", "usp-title", "UVP 3 · Risk", [""]], ["UVP и тултипы", "usp-tooltips", "UVP 3 · Risk", ["", "", ""]],
  ["Hero и Description", "hero", "", [""]],
  ["Hero и Description", "description", "", ["", "### Your wins", "", "### How does it work?", "1. "]],
  ["Requirements", "requirements", "", [""]],
  ["H1, meta", "h1", "", [""]], ["H1, meta", "page-title", "", [""]], ["H1, meta", "meta-description", "", [""]],
  ["SEO-футер", "seo-footer", "", ["## ", ""]],
  ["FAQ", "faq", "", ["## ", "Q: ", "A: ", "Q: ", "A: ", "Q: ", "A: ", "Q: ", "A: "]],
  ["Фид", "feed-subtitle", "", [""]], ["Фид", "feed-description", "", [""]],
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function inline(s, accent) {
  return esc(s)
    .replace(/==(.+?)==/g, (_, t) => `<span style="color: ${accent};"><strong>${t}</strong></span>`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

export function plain(s) {
  return s.replace(/==(.+?)==/g, "$1").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[(.+?)\]\((https?:\/\/[^)\s]+)\)/g, "$1");
}

function blocksHtml(lines, accent) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i].trimEnd();
    if (!ln.trim()) { i++; continue; }
    if (ln.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const head = rows[0].map((c) => `<th>${inline(c, accent)}</th>`).join("");
      const body = rows.slice(1).map((r) => "<tr>" + r.map((c) => `<td>${inline(c, accent)}</td>`).join("") + "</tr>").join("");
      out.push(`<table><tr>${head}</tr>${body}</table>`);
      continue;
    }
    const list = [[/^- (.+)/, "ul"], [/^\d+\. (.+)/, "ol"]].find(([re]) => re.test(ln));
    if (list) {
      const [re, tag] = list, items = [];
      while (i < lines.length && re.test(lines[i].trimEnd())) {
        items.push(`<li>${inline(lines[i].trimEnd().match(re)[1], accent)}</li>`);
        i++;
      }
      out.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }
    if (ln.startsWith("### ")) out.push(`<h6>${inline(ln.slice(4), accent)}</h6>`);
    else if (ln.startsWith("## ")) out.push(`<h2><strong>${inline(ln.slice(3), accent)}</strong></h2>`);
    else out.push(`<p>${inline(ln, accent)}</p>`);
    i++;
  }
  return out.join("");
}

const filled = (lines) => lines.filter((l) => l.trim());

// Admin-ready HTML for a field (what the Copy button puts on the clipboard as text/html).
export function toHtml(kind, lines, accent = GREEN, method = null) {
  if (kind === "requirements") return reqHtml(buildRequirements(lines, method).items);
  if (kind === "description" || kind === "seo-footer") return blocksHtml(lines, accent);
  const ls = filled(lines);
  if (kind === "card-preview")
    return "<ul>" + ls.map((l, n) => {
      const t = inline(l, accent);
      return n === 0 ? `<li><span style="color: ${accent};"><strong>${t}</strong></span></li>` : n === 1 ? `<li><strong>${t}</strong></li>` : `<li>${t}</li>`;
    }).join("") + "</ul>";
  if (kind === "usp-tooltips") return "<ul>" + ls.map((l) => `<li>${inline(l.replace(/^- /, ""), accent)}</li>`).join("") + "</ul>";
  if (kind === "hero") return `<p>${inline(ls.join(" "), accent)}</p>`;
  return esc(ls.join(" "));
}

export function toText(kind, lines, method = null) {
  if (kind === "requirements") return reqText(buildRequirements(lines, method).items);
  if (kind === "faq") return filled(lines).map((l) => plain(l).trimEnd()).join("\n");
  const ls = lines.map((l) => plain(l.replace(/^(- |\d+\. |#{2,3} )/, "")).trimEnd());
  if (kind === "description" || kind === "seo-footer") return ls.join("\n").trim();
  const f = filled(ls);
  return kind === "card-preview" || kind === "usp-tooltips" ? f.join("\n") : f.join(" ");
}

// Boost method of the offer: "self-play" | "piloted" | "both". Copy must not promise the other mode's mechanics.
export const METHODS = { "self-play": "Только Self-play", "piloted": "Только Piloted", "both": "Self-play и Piloted" };
const SELF_PLAY = /\byou (click|stand|join (the|our) booster|claim [^.;]*\bat the altar)|\bstand(s|ing)? (by )?in the party|\bstay(s|ing)? in the party|\bwatch(es)? (the trial|from the party)|\bno login|\bstay on your (own )?account|\bat the altar yourself|\byou pick it at the altar/i;
const PILOTED = /\bshare (your )?account|\baccount details|\bbooster logs? in|\blogs? into your account|\bwhile you (rest|sleep|are away)|\bplays? for you/i;

function methodWarnings(line, method) {
  const t = plain(line), w = [];
  if (!method) return w;
  const sp = SELF_PLAY.test(t), pi = PILOTED.test(t), saysSp = /self-play/i.test(t), saysPi = /piloted/i.test(t);
  if (method === "piloted" && (sp || saysSp)) w.push(`«${t.slice(0, 60)}» — в оффере только Piloted, а текст про self-play`);
  if (method === "self-play" && (pi || saysPi)) w.push(`«${t.slice(0, 60)}» — в оффере только Self-play, а текст про piloted`);
  if (method === "both" && sp && !saysSp) w.push(`«${t.slice(0, 60)}» — верно только для self-play; в оффере оба способа: уточните «Self-play: …» или напишите нейтрально`);
  if (method === "both" && pi && !saysPi) w.push(`«${t.slice(0, 60)}» — верно только для piloted; уточните «Piloted: …» или напишите нейтрально`);
  return w;
}

// ---- Requirements: free-form context (RU/EN) → site-format list of what the buyer must have or do ----
// Each rule: [pattern on one clause, function(match) → requirement in English | null (not a requirement)].
// (?<![\p{L}\d]) / (?![\p{L}\d]) are word boundaries that also work for Cyrillic (\b does not).
const NOT_REQ = /не нуж|не треб|(?<![\p{L}\d])без(?![\p{L}\d])|no need|not needed|not required|(?<![\p{L}\d])no \p{L}+ (?:needed|required)/iu;
const REQ_RULES = [
  [/(?:lvl|level|лвл|уровень|уровня|уровне|ур\.?)\s*(?:от|from|min|минимум|не ниже)?\s*(\d{1,3})\+?|(\d{1,3})\+?\s*(?:lvl|level|лвл|уров|ур\.?)/iu, (m) => `Character level ${m[1] || m[2]} or higher`],
  [/^(.+?)\s+(?:открыт\p{L}*|разблокирован\p{L}*|unlocked)$/iu, (m) => `${m[1]} unlocked`],
  [/^(?:открыт\p{L}*|разблокирован\p{L}*|unlocked|доступ к)\s+(.+)$/iu, (m) => `${m[1]} unlocked`],
  [/(?:кампани\p{L}*|campaign).*(?:пройден|заверш|done|completed|complete)|(?:пройден\p{L}*|заверш\p{L}*)\s+кампани/iu, () => "Campaign completed"],
  [/(?<![\p{L}\d])(?:акт|act)\s*(\d+)/iu, (m) => `Act ${m[1]} completed`],
  [/асценд\p{L}*|ascended|ascendancy chosen/iu, () => "Your character has already chosen an Ascendancy"],
  [/базов\p{L}* класс|base class|same class|тот же класс/iu, () => "The new Ascendancy belongs to your base class"],
  [/hardcore|хардкор|(?<![\p{L}\d])HC(?![\p{L}\d])/iu, () => "Hardcore character"],
  [/инвентар\p{L}*|inventory|stash|место в/iu, () => "Free inventory space for the delivery"],
  [/(?<![\p{L}\d])рар\p{L}*|rare item/iu, () => "A rare item to put in the trade window"],
  [/2fa|steam guard|двухфактор\p{L}*|код\p{L}* подтвержд/iu, () => "Piloted: 2FA / Steam Guard codes ready at login"],
  [/онлайн|online|в сети/iu, () => "Self-play: be online for the session"],
  [/(?<![\p{L}\d])(?:pc|пк)(?![\p{L}\d])/iu, () => "PC platform"],
  [/ps5|playstation/iu, () => "PlayStation platform"],
  [/xbox/iu, () => "Xbox platform"],
];
const CYR = /[а-яё]/i;

// lines: context written by the content manager. Returns {items, notes}.
export function buildRequirements(lines, method) {
  const items = [], notes = [];
  const clauses = lines.join("\n").split(/[\n;]+|,(?![^(]*\))|(?<=[a-zа-я0-9)])\.\s+/i).map((c) => c.trim().replace(/\.$/, "")).filter(Boolean);
  for (const c of clauses) {
    if (NOT_REQ.test(c)) { notes.push(`«${c}» — не требование к клиенту, перенесите в UVP или Wins`); continue; }
    const hit = REQ_RULES.find(([re]) => re.test(c));
    if (hit) {
      const r = hit[1](c.match(hit[0]));
      if (CYR.test(r)) notes.push(`«${c}» — название распознано не полностью, допишите его по-английски`);
      else items.push(r);
    } else if (CYR.test(c)) notes.push(`«${c}» — не распознано, допишите по-английски`);
    else items.push(c[0].toUpperCase() + c.slice(1));
  }
  if (method) items.push("Self-play: be online for the session", "Piloted: account access for the session");
  // With one boost method the "Self-play:" / "Piloted:" prefix is noise, and the other mode's items do not apply.
  const fitted = [];
  for (const it of items) {
    const mode = /^Self-play: /.test(it) ? "self-play" : /^Piloted: /.test(it) ? "piloted" : null;
    if (!mode || !method || method === "both") fitted.push(it);
    else if (mode === method) fitted.push(it.replace(/^(?:Self-play|Piloted): (.)/, (_, c) => c.toUpperCase()));
    else if (!/be online for the session|account access for the session/.test(it)) notes.push(`«${it}» — только для ${mode}, а в оффере ${method}; пункт убран`);
  }
  return { items: [...new Set(fitted)], notes };
}

const reqHtml = (items) => "<ul>" + items.map((t, n) => `<li>${esc(t)}${n === items.length - 1 ? "." : ";"}</li>`).join("") + "</ul>";
const reqText = (items) => items.map((t, n) => t + (n === items.length - 1 ? "." : ";")).join("\n");

const words = (s) => (s.match(/[A-Za-z0-9][\w'’.-]*/g) || []).length;
const STOPW = new Set(["the", "a", "in", "of", "you", "your", "with", "to", "all", "for"]);
const norm = (s) => new Set((plain(s).toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => !STOPW.has(w)));

// ---- SEO checks backed by the audit of 99 pages (seo/audit-2026-10-25.md) ----
// FAQ block: "Q: …" then "A: …" (an answer may run over several lines until the next "Q:").
export function parseFaq(lines) {
  const pairs = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    if (/^Q:/i.test(l)) pairs.push({ q: l.replace(/^Q:\s*/i, ""), a: "" });
    else if (pairs.length) pairs[pairs.length - 1].a += (pairs[pairs.length - 1].a ? " " : "") + l.replace(/^A:\s*/i, "");
  }
  return pairs;
}
// Who does what and how the order goes: process words that do not belong in UVP chips and tooltips.
const PROCESS = /\b(boosters?|we|our|pros?|team|carr(?:y|ies|ied)|clears?|cleared|runs? (?:it|the)|invites?|logs? in|joins?|watch(?:es)? from|(?<!self-)plays? it|from the party|in the party|step|process|checkout)\b/i;
// The FAQ block has its own title field in the admin ("Path of Exile 2 Ascension Trials FAQ"): the "## …" line.
export const faqTitle = (lines) => (lines.find((l) => /^##\s/.test(l.trim())) || "").trim().replace(/^##\s*/, "");
// Lists of the footer: runs of "- " lines (bulleted) and of "1. " lines (numbered).
function listRuns(lines) {
  let bullet = 0, numbered = 0, prev = "";
  for (const raw of lines) {
    const l = raw.trim(), kind = /^- /.test(l) ? "b" : /^\d+\.\s/.test(l) ? "n" : l ? "t" : prev;
    if (kind === "b" && prev !== "b") bullet++;
    if (kind === "n" && prev !== "n") numbered++;
    prev = kind;
  }
  return { bullet, numbered };
}
const SELF_PRAISE = /\b(overgear|we|our)\b[^.]*\b(best|safest|trusted|stands? out|widely considered|look no further|most reliable)\b|\b(best|safest) (site|place|website)\b[^.]*\b(overgear|we|our)\b/i;
const CTA = /\b(buy now|order now|order today|purchase now|get started now)\b/i;

// SEO blocks follow Overgear's own format (seo/overgear-format.md, decided 25.10.2026), not generic SEO advice.
function seoChecks(b, txt, game) {
  if (b.kind === "page-title" && txt.trim()) {
    // Keyword pair ("Buy PoE 2 X Boost, Path of Exile 2 X Service | Overgear") or keyword — benefit
    if (!/,| — | – |: /.test(txt)) b.note.push("формат Overgear: пара ключей через запятую («Buy PoE 2 X Boost, Path of Exile 2 X Service») или «ключ — выгода»");
    if (txt.length > 60 && !/^buy\b/i.test(txt) && !/ — | – /.test(txt.slice(0, 60))) b.note.push("Google покажет ~60 символов — главная фраза должна идти первой");
    if ((txt.match(/[|–—-]\s/g) || []).length > 2) b.note.push("больше двух разделителей — title читается как набор слов");
  }
  // Meta description sells the click in Google: the result and the time as numbers, not adjectives
  if (b.kind === "meta-description" && txt.trim()) {
    if (!/\d/.test(txt)) b.note.push("нет ни одной цифры — уровень, срок, ilvl или число заказов сильнее в сниппете");
    if (/\b(cheap price|24\/7|order (now|today)|skip (the )?routine|affordable)\b/i.test(txt)) b.warn.push("кирпичи старых description («cheap price», «24/7», «order now», «affordable») — замените сущностями игры и цифрой");
  }
  if (b.kind === "seo-footer" && txt.trim()) {
    const h2 = b.lines.filter((l) => /^## /.test(l)).map((l) => plain(l.slice(3)).trim());
    if (!h2.length) b.warn.push("нет ни одного H2 (## …)");
    else if (!/^about\b/i.test(h2[0])) b.note.push("формат Overgear: первый H2 — «About {поисковая фраза}»");
    if (h2.length === 1) b.note.push("один H2 — по формату нужен второй: «{фраза} Includes» или «… Rewards» со списком");
    for (let i = 0; i < h2.length; i++) for (let j = i + 1; j < h2.length; j++)
      if (h2[i].toLowerCase().replace(/^about\s+/, "") === h2[j].toLowerCase().replace(/^about\s+/, "")) b.warn.push(`H2 «${h2[j]}» повторяет фразу другого H2 — у каждого H2 своя поисковая фраза`);
    // Overgear rule, 25.10.2026: one bulleted list (Includes / Rewards) and one numbered list (How … Works steps)
    const runs = listRuns(b.lines);
    if (runs.bullet !== 1) b.warn.push(runs.bullet ? `маркированных списков: ${runs.bullet} — в футере ровно один (Includes / Rewards)` : "нет маркированного списка — в футере ровно один: пункты Includes / Rewards («- …;»)");
    if (runs.numbered !== 1) b.warn.push(runs.numbered ? `нумерованных списков: ${runs.numbered} — в футере ровно один (шаги How … Works)` : "нет нумерованного списка — в футере ровно один: шаги How … Works («1. …»)");
    const w = txt.split(/\s+/).filter(Boolean).length;
    if (w < 250 || w > 600) b.note.push(`${w} слов — рабочий диапазон 250–550`);
  }
  if (b.kind === "faq" && txt.trim()) {
    const pairs = parseFaq(b.lines);
    if (!pairs.length) b.warn.push("формат: строка «Q: вопрос», под ней «A: ответ»");
    // On the site the FAQ is its own block with a title: "[Game] [product] FAQ"
    const title = faqTitle(b.lines);
    if (!title) b.warn.push("нет заголовка блока — первая строка «## {Игра} {продукт} FAQ», например «## Path of Exile 2 Ascension Trials FAQ»");
    else if (!/FAQ$/i.test(title)) b.note.push(`заголовок «${title}» — на сайте он заканчивается на «FAQ»`);
    if (pairs.length && (pairs.length < 3 || pairs.length > 6)) b.note.push(`${pairs.length} вопр. — рабочий диапазон 3–6`);
    // template pairs ("Q: " / "A: " with nothing yet) are not questions; an empty block gets one clear remark
    if (pairs.length && !pairs.some((p) => p.q.trim())) b.warn.push("нет ни одного вопроса — отметьте вопросы в наборе над блоком и нажмите «Write answers» или «Insert questions»");
    for (const { q, a } of pairs.filter((p) => p.q.trim() || p.a.trim())) {
      if (!q.trim().endsWith("?")) b.warn.push(`«${q.slice(0, 50)}» — вопрос без знака «?»`);
      if (!a.trim()) { b.warn.push(`«${q.slice(0, 50)}» — нет ответа`); continue; }
      if (SELF_PRAISE.test(a)) b.warn.push(`ответ на «${q.slice(0, 40)}» хвалит Overgear вместо ответа — объясните механизм`);
      if (CTA.test(a)) b.warn.push(`ответ на «${q.slice(0, 40)}» с призывом купить — FAQ отвечает, а не продаёт`);
      const first = plain(a).split(/(?<=[.!?])\s/)[0];
      if (first.split(/\s+/).length > 30) b.note.push(`«${q.slice(0, 40)}» — первое предложение ответа длиннее 30 слов; ответ должен идти сразу`);
    }
  }
}

// boxes: [{kind, label, lines}]  →  {boxes: [{...box, warn: [], note: []}], page: [messages]}
export function check(boxes, game, method) {
  const out = boxes.map((b) => ({ ...b, warn: [], note: [] }));
  for (const b of out) {
    const lim = TYPES[b.kind][3], ls = filled(b.lines).map(plain), txt = toText(b.kind, b.lines, method);
    if (b.kind === "requirements") {
      const r = buildRequirements(b.lines, method);
      for (const n of r.notes) (/не распознано|не полностью/.test(n) ? b.warn : b.note).push(n);
      if (!method) b.warn.push("не выбран способ (self-play / piloted / оба) — от него зависят пункты про онлайн и доступ к аккаунту");
      continue;
    }
    if (lim.lines && ls.length !== lim.lines) b.warn.push(`нужно строк: ${lim.lines}, сейчас ${ls.length}`);
    if (lim.line) for (const l of ls) if (l.length < lim.line[0] || l.length > lim.line[1]) b.warn.push(`«${l}» — ${l.length} симв. (норма ${lim.line[0]}–${lim.line[1]})`);
    if (lim.item) {
      for (const l of ls) {
        const n = words(l); // owner's hard rule, 25.10.2026: tooltip <= 5 words, 3-4 is ideal
        if (n > 5) b.warn.push(`тултип ${n} слов (максимум 5): «${l}»`);
        else if (n === 5 || n < 3) b.note.push(`«${l}» — ${n} сл., идеально 3–4`);
        if (l.length > lim.item) b.warn.push(`тултип длиннее ${lim.item}: «${l}»`);
      }
      const total = ls.reduce((a, l) => a + l.length, 0);
      if (total > lim.total) b.warn.push(`тултипы вместе ${total} > ${lim.total}`);
    }
    if (lim.len && txt && (txt.length < lim.len[0] || txt.length > lim.len[1])) b.warn.push(`${txt.length} симв. (норма ${lim.len[0]}–${lim.len[1]})`);
    if (!txt.trim()) b.warn.push("пусто");
    if (/проверить/i.test(txt) || (/\[[^\]]+\]/.test(txt) && !/\]\(/.test(b.lines.join(" ")))) b.warn.push("есть пометка «проверить» / заглушка в [скобках]");
    // FAQ questions are real search queries ("What is the best site…?"); only the answers must be clean
    const stopTxt = b.kind === "faq" ? parseFaq(b.lines).map((p) => p.a).join(" ") : txt;
    // "cheap … for sale" is one of the search phrases the meta title is built from
    for (const m of stopTxt.matchAll(STOP)) if (!(b.kind === "page-title" && /^cheap$/i.test(m[0]))) b.warn.push(`стоп-слово «${m[0]}»`);
    for (const l of filled(b.lines)) b.warn.push(...methodWarnings(l, method));
    // Self-play / piloted is picked in the options block ("холодильник") on the offer page, not at checkout (25.10.2026)
    if (/\bcheck-?out\b|\bat purchase\b|\bwhen (you )?order(ing)?\b/i.test(txt) && /self-?play|piloted|method|mode/i.test(txt))
      b.warn.push("способ (self-play / piloted) клиент выбирает в блоке опций на странице оффера, а не при оплате");
    // UVP and tooltips state the result for the player, never the process — that belongs to "How does it work" (25.10.2026)
    if (b.kind === "usp-title" || b.kind === "usp-tooltips")
      for (const l of filled(b.lines)) {
        const m = plain(l).match(PROCESS);
        if (m) b.warn.push(`«${plain(l)}» — описание процесса («${m[0]}»); в UVP только результат для игрока, процесс — в How does it work`);
      }
    seoChecks(b, txt, game);
    if (b.kind.startsWith("feed-") && txt.trim()) {
      if (!txt.trimEnd().endsWith(".")) b.warn.push("нет точки в конце — в фиде строка заканчивается точкой");
      if (game && GAMES[game]) {
        const [short, full] = GAMES[game], need = b.kind === "feed-subtitle" ? short : full;
        if (!txt.includes(need) && !txt.includes(full)) b.warn.push(`нет названия игры «${need}»`);
      }
    }
  }
  // Logic check: copy must not promise access below the level the Requirements ask for.
  const req = out.find((b) => b.kind === "requirements");
  const reqLevel = req && Math.max(0, ...buildRequirements(req.lines, method).items.map((t) => +(t.match(/^Character level (\d+)/) || [])[1] || 0));
  if (reqLevel) for (const b of out) if (b !== req)
    for (const m of toText(b.kind, b.lines, method).matchAll(/\b(?:level|lvl)\s*(\d{1,3})\b/gi))
      if (+m[1] < reqLevel) b.warn.push(`текст обещает уровень ${m[1]}, а в Requirements — от ${reqLevel}`);
  const page = [], titles = out.filter((b) => b.kind === "usp-title"), tips = out.filter((b) => b.kind === "usp-tooltips");
  if (titles.length && (titles.length < 3 || titles.length > 4)) page.push(`UVP на странице: ${titles.length} (норма 3–4)`);
  if (tips.length !== titles.length) page.push(`UVP ${titles.length}, групп тултипов ${tips.length} — у каждого UVP своя группа из 3`);
  for (const cp of out.filter((b) => b.kind === "card-preview"))
    for (const l of filled(cp.lines))
      for (const t of titles) {
        const a = norm(l), c = norm(t.lines[0] || "");
        if (!a.size || !c.size) continue;
        const inter = [...a].filter((x) => c.has(x)).length, uni = new Set([...a, ...c]).size;
        if (inter / uni >= 0.6) cp.warn.push(`превью «${plain(l)}» повторяет UVP «${plain(t.lines[0])}»`);
      }
  return { boxes: out, page };
}

// ```copy <kind> <label>``` blocks of an offer .md → {title, boxes}
export function parseMd(src) {
  src = src.replace(/\r\n?/g, "\n"); // files saved on Windows have CRLF; \r must not reach the clipboard
  const title = (src.match(/^# (.+)$/m) || [, "Без названия"])[1].trim();
  const method = (src.match(/<!-- content-helper: method=(self-play|piloted|both) -->/) || [])[1] || null;
  const boxes = [];
  let section = null;
  const re = /^## ([^\n]+)$|^```copy ([a-z0-9-]+)([^\n]*)\n([\s\S]*?)^```/gm;
  for (const m of src.matchAll(re)) {
    if (m[1]) { section = m[1].replace(/^Копибоксы:\s*/, "").trim(); section = section[0].toUpperCase() + section.slice(1); continue; }
    const kind = m[2];
    if (!TYPES[kind]) throw new Error(`unknown copy type '${kind}'`);
    const rest = m[3];
    boxes.push({ kind, label: rest.replace(/accent=\w+/, "").trim(), accent: /accent=orange/.test(rest) ? "orange" : "green", section, lines: m[4].replace(/\n$/, "").split("\n") });
  }
  return { title, method, boxes };
}

// boxes → markdown with ```copy blocks (what the app exports; tools/apply.mjs merges it into the offer file)
export function toMd(title, boxes, method) {
  const out = [`# ${title}`, ""];
  if (method) out.push(`<!-- content-helper: method=${method} -->`, "");
  let last = null;
  for (const b of boxes) {
    if (b.section !== last) { out.push(`## Копибоксы: ${b.section || "поля"}`, ""); last = b.section; }
    out.push("```copy " + [b.kind, b.label, b.accent === "orange" ? "accent=orange" : ""].filter(Boolean).join(" "), ...b.lines, "```", "");
  }
  return out.join("\n");
}
