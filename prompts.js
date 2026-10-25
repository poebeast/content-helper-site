// What Claude is asked, and how its answers become fields. No SDK here: the same requests go to the API
// (ai.js, with a key) and to the claude.ai chat (Claude Pro, copied and pasted by the content manager).
import { TYPES, GAMES, METHODS, toText } from "./rules.js?v=127df33a";
import { exampleFor, SEO_REFERENCE } from "./examples.js?v=127df33a";

// Stable system prompt (cached on the API): the Overgear copy rules the app also checks.
export const SYSTEM = `You write offer copy for Overgear, a marketplace of game boosting and in-game items (Path of Exile 1/2, Diablo 2/3/4, World of Warcraft and WoW Forever, Last Epoch, Torchlight: Infinite). Copy is in English and is pasted into the site admin as is.

Every offer closes three axes in plain, gamer-marketing language:
- Time: how much the buyer saves or how soon they get the result — a number.
- Outcome: what the buyer can do afterwards — game entities (tiers, levels, bosses, points), not adjectives.
- Risk: why it is safe to buy — a mechanism the player can picture (trade looks like a regular trade, loot stays on the character, self-play option, item picked by name). Never an adjective like "safe".

Hard rules:
- Never mention refunds, money-back, compensation or guarantees.
- Never invent facts: use only numbers, times, prices and game facts present in the offer context. If a number is missing, write without it.
- No clichés or AI-sounding phrasing: fast, quick, instant, safe, secure, premium, reliable, effortless, seamless, smooth, dominate, unleash, ultimate, perfect, best, professional, expert, hassle-free, cheap, versatile, tailored, wide selection, 24/7, journey, "whether you're…", "in no time", "unlock the full potential", "look no further", "order now", self-praise of Overgear. The one exception: "cheap" inside the search phrase "cheap … for sale" in the meta title.
- Respect the boost method. self-play only: nothing about sharing the account. piloted only: nothing that needs the buyer in the game (stand in the party, click the altar). both: neutral wording, or prefix the mechanics with "Self-play:" / "Piloted:".
- Search phrases (brief "keywords", most searched first): across hero, Description, SEO footer and FAQ each phrase appears at most once in the whole offer — check the current fields of the offer before using one. Never two sentences with a phrase in a row: at least one sentence without any phrase between them. Prefer phrases higher in the list that are not used yet.
- UVP titles and their tooltips state only the RESULT for the player — what they get, keep, save or can do now. Never the process or who does what (no "booster clears…", "we run…", "join the party", "watch from…"): the process belongs to "How does it work".
- Self-play or piloted is chosen by the buyer in the options block on the offer page — never write "at checkout" or "when you order".
- Catalog preview lines must not repeat the page UVP titles word for word.
- Markup in lines: ==phrase== is the coloured bold key phrase, **bold** is bold. In SEO footer and Description: "## " H2, "### " small heading, "- " list item, "1. " numbered step, [text](url) link, one line = one paragraph. FAQ: "Q: question?" line, then "A: answer" line.`;
const VARIANTS = "Return exactly 3 variants that differ in angle, not just in synonyms, each following the field's format and limits. Explain each variant in one short Russian sentence (why it is better for the stated feedback).";

const FORMAT = {
  "card-preview": "Exactly 3 lines, 12–28 characters each: 1) main outcome or hook, 2) time, 3) risk or difference from neighbouring cards.",
  "usp-title": "One line, 2–4 words, 12–32 characters, one axis.",
  "usp-tooltips": "Exactly 3 lines, max 5 words each (3–4 ideal), each a result for the player that strengthens its UVP's axis (what they get, keep or save — e.g. 'Ascendancy active same day', 'Self-play: account stays yours'), never a process step, no repeat of the UVP.",
  "hero": "One sentence, 120–180 characters, starts with the main commercial keyword, exactly one ==key phrase==.",
  "description": "First line: hero (as above). Then '### Your wins', 3–6 lines '<emoji> **object** — gain;' (first one may use ==...==), then '### How does it work?', one bold flow line, 3–4 numbered steps.",
  "h1": "One line, the short main keyword without 'Buy', up to 45 characters (e.g. 'PoE 2 Power Leveling', 'WoW Forever The Deadmines Boost').",
  "page-title": "One line, 45–85 characters, Overgear's keyword-pair formula: 'Buy {search phrase with the short game name}, {second search phrase with the full game name}', then ' | Overgear' if it still fits 85. Service: 'Buy PoE 2 X Boost, Path of Exile 2 X Service | Overgear'; currency or item: 'Buy PoE 2 X, Cheap Path of Exile 2 X for Sale | Overgear'; one-name games: 'Buy WoW Forever X Boost, WoW Forever X Carry'. For a bundle or an offer with one strong hook instead: '{keyword} — {main benefit with a number} | Overgear'. Both phrases come from the brief's search phrases.",
  "meta-description": "120–160 characters, one or two sentences, ending with a period. Open with the main search phrase ('Buy {phrase} and …' or '{phrase} — …'), or with the player's pain as a short question followed by the phrase. Then game entities by name (dungeon, boss, title, mount, ilvl, level), a number, options (region, faction, self-play, Loot Priority) and one trust fact if the brief has it (verified pros, no login details needed, order count). Never 'cheap price', '24/7 support', 'order now', 'affordable'.",
  "seo-footer": "250–550 words in Overgear's footer formula. '## About {search phrase}': 2–4 paragraphs — what it is in the game (place, level range, story, mechanics by name), why it is slow or annoying solo (group finder, travel, wipes, RNG, weekly caps — the real pain), one sentence how the service takes it off the player's hands; name the game's entities (bosses, stages, tiers) in the text or in a markdown table, not in a list. '## {another search phrase} Includes' or '… Rewards': a lead-in paragraph, 'The service includes:' or 'What a run brings back:', a '- ' list of 4–7 concrete items by name (each item ends with ';', the last with '.'), one closing sentence with another search phrase. '## How {search phrase} Works': one lead-in sentence, then a numbered list '1. …' of 3–5 steps (how the order goes or how the mechanic works). Optional '## {keyword} in {current league or season}' (checked facts only); a markdown table where the game has numbers. The footer has exactly ONE bulleted list (Includes / Rewards) and exactly ONE numbered list (How … Works) — no other lists. Every H2 uses a different search phrase. No links unless the brief gives URLs. No self-praise, no 'professional players', no 'cheap', no '24/7'.",
  "faq": "A separate block after the SEO footer. First line: '## {full game name} {product} FAQ' (e.g. '## Path of Exile 2 Ascension Trials FAQ'). Then 3–6 pairs. 'Q: …?' then 'A: …'. If the brief has 'faqPicked', use exactly those questions in that order (fix only grammar); otherwise start with the brief's 'faqSupport' questions (asked by real buyers in support). Real player questions with the game name ('How do I get to The Deadmines in WoW Forever?', 'What level is required for …?', 'What is included in {search phrase}?'). The first sentence of each answer answers directly, with a fact or number. No selling, no self-praise.",
  "feed-subtitle": "One line, 30–60 characters, short game name (e.g. 'PoE 2'), ends with a period.",
  "feed-description": "One sentence, 90–160 characters, full game name (e.g. 'Path of Exile 2'), what the buyer gets, ends with a period.",
};

// Field name as Claude sees it; fact-check findings come back with it.
export const factField = (b) => `${TYPES[b.kind][0]}${b.label ? " (" + b.label + ")" : ""}`;

function context(offer) {
  const fields = offer.boxes.map((b) => `- ${factField(b)}: ${toText(b.kind, b.lines, offer.method).slice(0, 600) || "—"}`).join("\n");
  const brief = Object.entries(offer.brief || {}).filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join("\n");
  const ex = exampleFor((offer.brief || {}).archetype);
  const reference = ex ? `\n\nReference offer for this archetype — ${ex.name} (${ex.url}), the page the team takes as the base. Take its structure, depth, the kind of Risk mechanisms and the voice. Do not copy its sentences; never take its numbers unless the brief has the same ones; skip its known weak spots.\n${ex.text}` : "";
  return `Game: ${(GAMES[offer.game] || [offer.game, offer.game])[1]}\nOffer: ${offer.title}\nBoost method: ${offer.method || "not set"} (${METHODS[offer.method] || "—"})\n\nBrief:\n${brief || "—"}${reference}\n\nCurrent fields of the offer:\n${fields}`;
}

// ---- Regenerate: 3 variants of one field (or of a UVP with its tooltips) ----
// target: {kind, label, lines} or {kind: "uvp", title: box, tooltips: box}
export function regenPrompt(offer, target, feedback) {
  const isUvp = target.kind === "uvp";
  const current = isUvp ? `UVP title: ${target.title.lines.join(" ")}\nTooltips:\n${target.tooltips.lines.join("\n")}` : target.lines.join("\n");
  const format = isUvp ? `UVP title — ${FORMAT["usp-title"]}\nTooltips — ${FORMAT["usp-tooltips"]}` : FORMAT[target.kind] || "Follow the current format.";
  return `${context(offer)}${SEO_KINDS.includes(target.kind) ? seoBlock : ""}\n\nField to rewrite: ${isUvp ? "UVP " + (target.title.label || "") + " with its 3 tooltips" : TYPES[target.kind][0] + (target.label ? " (" + target.label + ")" : "")}\nFormat and limits: ${format}\n\nCurrent text:\n${current || "(empty)"}\n\nWhat is wrong / what the content manager wants (Russian):\n${feedback || "Сделай сильнее по правилам."}\n\n${VARIANTS}`;
}
export const variantSchema = (isUvp) => isUvp
  ? { type: "object", additionalProperties: false, required: ["variants"], properties: { variants: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "tooltips", "why"], properties: { title: { type: "string" }, tooltips: { type: "array", items: { type: "string" } }, why: { type: "string" } } } } } }
  : { type: "object", additionalProperties: false, required: ["variants"], properties: { variants: { type: "array", items: { type: "object", additionalProperties: false, required: ["lines", "why"], properties: { lines: { type: "array", items: { type: "string" } }, why: { type: "string" } } } } } };
export const regenVariants = (out, isUvp) => ((out && out.variants) || []).slice(0, 3)
  .map((v) => (isUvp ? { title: [String(v.title || "")], tooltips: (v.tooltips || []).map(String), why: v.why } : { lines: (v.lines || []).map(String), why: v.why }));

// ---- Build offer: the whole offer from the brief ----
const str = { type: "string" }, strs = { type: "array", items: str };
const obj = (props) => ({ type: "object", additionalProperties: false, required: Object.keys(props), properties: props });
export const COMPOSE_SCHEMA = obj({
  card_preview: strs,
  uvps: { type: "array", items: obj({ axis: { type: "string", enum: ["Time", "Outcome", "Risk"] }, title: str, tooltips: strs }) },
  hero: str, description_rest: strs, h1: str, page_title: str, meta_description: str,
  seo_footer: strs, faq_title: str, faq: { type: "array", items: obj({ q: str, a: str }) }, feed_subtitle: str, feed_description: str,
});
const COMPOSE_FORMAT = `Write the complete offer page, one version of every field:
- card_preview — ${FORMAT["card-preview"]}
- uvps — 3 or 4 UVPs: one per axis (Time, Outcome, Risk; a 4th Outcome if the brief gives a second result). Each title — ${FORMAT["usp-title"]} Each tooltips — ${FORMAT["usp-tooltips"]}
- hero — ${FORMAT["hero"]}
- description_rest — the Description after the hero line: '### Your wins', 3–6 lines '<emoji> **object** — gain;', then '### How does it work?', one bold flow line, 3–4 numbered steps ('1. …').
- h1 — ${FORMAT["h1"]}
- page_title — ${FORMAT["page-title"]}
- meta_description — ${FORMAT["meta-description"]}
- seo_footer — ${FORMAT["seo-footer"]} One array item = one line (H2 lines start with '## ').
- faq_title — the FAQ block title: '{full game name} {product} FAQ', e.g. 'Path of Exile 2 Ascension Trials FAQ'.
- faq — if the brief has 'faqPicked', exactly those questions in that order (fix only grammar); otherwise the brief's 'faqSupport' questions first, then real player questions with the game name, 3–6 in total; the first sentence of each answer answers directly with a fact or number; no selling. Plain text, without the 'Q:' / 'A:' prefixes.
- feed_subtitle — ${FORMAT["feed-subtitle"]}
- feed_description — ${FORMAT["feed-description"]}
The search phrases from the brief go into hero, Description, SEO footer and FAQ — each phrase at most once in the whole offer, never in two sentences in a row. The main keyword opens hero and H1.`;
// Meta tags, footer and FAQ follow Overgear's own format — real examples from the site go with every SEO request.
const SEO_KINDS = ["h1", "page-title", "meta-description", "seo-footer", "faq"];
const seoBlock = `\n\nOvergear's SEO format — follow these real examples from the site in structure, length and voice (seo/overgear-format.md):\n${SEO_REFERENCE}`;
export const composePrompt = (offer) => `${context(offer)}${seoBlock}\n\n${COMPOSE_FORMAT}`;
// Answer → boxes in TEMPLATE order.
export function composeBoxes(o, offer) {
  if (!o || typeof o !== "object") throw new Error("EMPTY");
  const brief = offer.brief || {}, list = (x) => (Array.isArray(x) ? x.map(String) : []), one = (x) => String(x || "");
  const box = (section, kind, lines, label = "") => ({ kind, label, section, accent: "green", lines });
  return [
    box("Карточка в каталоге", "card-preview", list(o.card_preview).slice(0, 3)),
    ...(Array.isArray(o.uvps) ? o.uvps : []).slice(0, 4).flatMap((u, n) => [
      box("UVP и тултипы", "usp-title", [one(u.title)], `UVP ${n + 1} · ${u.axis || "Outcome"}`),
      box("UVP и тултипы", "usp-tooltips", list(u.tooltips).slice(0, 3), `UVP ${n + 1} · ${u.axis || "Outcome"}`)]),
    box("Hero и Description", "hero", [one(o.hero)]),
    box("Hero и Description", "description", [one(o.hero), ...list(o.description_rest)]),
    box("Requirements", "requirements", (brief.requirements || "").split("\n")),
    box("H1, meta", "h1", [one(o.h1)]), box("H1, meta", "page-title", [one(o.page_title)]), box("H1, meta", "meta-description", [one(o.meta_description)]),
    box("SEO-футер", "seo-footer", list(o.seo_footer)),
    box("FAQ", "faq", [`## ${one(o.faq_title).replace(/^#+\s*/, "")}`, ...(Array.isArray(o.faq) ? o.faq : []).flatMap(({ q, a }) => [`Q: ${one(q).replace(/^Q:\s*/, "")}`, `A: ${one(a).replace(/^A:\s*/, "")}`])]),
    box("Фид", "feed-subtitle", [one(o.feed_subtitle)]), box("Фид", "feed-description", [one(o.feed_description)]),
  ];
}

// ---- Fact check: current league and every game mechanic, by web search ----
export function factPrompt(offer) {
  const game = (GAMES[offer.game] || [offer.game, offer.game])[1];
  return `${context(offer)}

Fact-check this offer against ${game} as it is today, ${new Date().toISOString().slice(0, 10)}. Search the web: official patch notes and announcements, the official forum, the community wiki and databases for this game. Check:
1. The current league / season: its name and patch number. Compare with the brief's league and with every league, season or patch the copy names.
2. Every game mechanic, name and number the copy states: levels, tiers, points, trial and boss names, what a currency does, what unlocks what, max level.
Ignore Overgear's business facts (delivery and completion times, prices, order counts, boosters) — those come from the brief.

Reply in Russian, short. End with one \`\`\`json code block:
{"league": {"current": "<league name>", "patch": "<version>", "source": "<url>"},
 "findings": [{"field": "<field name exactly as before the colon in 'Current fields of the offer'>", "claim": "<exact quote from that field, up to 80 characters>", "verdict": "wrong" | "outdated" | "unverified" | "ok", "fix": "<what is true now, short, Russian>", "source": "<url>"}]}
Include "ok" findings too, one line each.`;
}
export function factResult(text) {
  const out = readJson(text);
  return { at: new Date().toISOString(), league: out.league || {}, findings: Array.isArray(out.findings) ? out.findings : [], summary: text.replace(/```json[\s\S]*?```/g, "").trim() };
}

// The JSON in an answer: the last ```json block, else the outermost {...}.
export function readJson(text) {
  const block = [...String(text).matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].pop();
  const raw = block ? block[1] : String(text).slice(String(text).indexOf("{"), String(text).lastIndexOf("}") + 1);
  if (!raw.trim()) throw new Error("EMPTY");
  return JSON.parse(raw);
}

// ---- Claude Pro: the same request as one chat message ----
// In the chat there is no system prompt or schema, so the rules go first and the exact JSON shape last.
const SHAPE = {
  compose: `{"card_preview": ["…", "…", "…"],
 "uvps": [{"axis": "Time", "title": "…", "tooltips": ["…", "…", "…"]}, {"axis": "Outcome", …}, {"axis": "Risk", …}],
 "hero": "…", "description_rest": ["### Your wins", "…", "### How does it work?", "…", "1. …"],
 "h1": "…", "page_title": "…", "meta_description": "…",
 "seo_footer": ["## About …", "…", "## … Includes", "…", "- …;", "- ….", "## How … Works", "…", "1. …", "2. …"],
 "faq_title": "… FAQ", "faq": [{"q": "…?", "a": "…"}],
 "feed_subtitle": "….", "feed_description": "…."}`,
  lines: `{"variants": [{"lines": ["…"], "why": "…"}, {"lines": ["…"], "why": "…"}, {"lines": ["…"], "why": "…"}]}`,
  uvp: `{"variants": [{"title": "…", "tooltips": ["…", "…", "…"], "why": "…"}, … 3 variants]}`,
};
export function chatPrompt(kind, user) {
  const tail = kind === "facts"
    ? "Use web search for every check. End with the ```json block described above."
    : `Answer with one \`\`\`json code block only — no text before or after it — in exactly this shape:\n${SHAPE[kind]}`;
  return `${SYSTEM}\n\n=====\n\n${user}\n\n=====\n${tail}`;
}
